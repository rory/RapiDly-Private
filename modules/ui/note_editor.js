import { dispatch as d3_dispatch } from 'd3-dispatch';
import { uiFormFields } from './form_fields';

import {
    event as d3_event,
    select as d3_select
} from 'd3-selection';

import { t } from '../util/locale';
import { svgIcon } from '../svg';
import { services } from '../services';
import {
    utilNoAuto,
    utilRebind
} from '../util';

import { utilDetect } from '../util/detect';

var _newComment;


export function uiNoteEditor(context) {
    var dispatch = d3_dispatch('change', 'cancel', 'save', 'changeInput');
    var commentLimit = 600;  // add a "more" link to comments longer than this length
    var _modified = false;
    var _note;

    function localeDateString(s) {
        if (!s) return null;
        var detected = utilDetect();
        var options = { day: 'numeric', month: 'short', year: 'numeric' };
        var d = new Date(s);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString(detected.locale, options);
    }


    function noteEditor(selection) {
        render(selection);
    }


    function noteHeader(selection) {
        selection.selectAll('.note-header')
            .data([_note], function(d) { return d.id; })
            .enter()
            .append('h3')
            .attr('class', 'note-header')
            .text(function(d) { return String(t('note.note') + ' ' + d.id); });
    }


    function noteComments(selection) {
        var comments = selection.selectAll('.comments')
            .data([0]);

        comments = comments.enter()
            .append('div')
            .attr('class', 'comments')
            .merge(comments);

        var commentEnter = comments.selectAll('.comment')
            .data(_note.comments)
            .enter()
            .append('div')
            .attr('class', 'comment');

        commentEnter
            .append('div')
            .attr('class', function(d) { return 'comment-avatar user-' + d.uid; })
            .call(svgIcon('#iD-icon-avatar', 'comment-avatar-icon'));

        var main = commentEnter
            .append('div')
            .attr('class', 'comment-main');

        var meta = main
            .append('div')
            .attr('class', 'comment-metadata');

        meta
            .append('div')
            .attr('class', 'comment-author')
            .each(function(d) {
                var selection = d3_select(this);
                var osm = services.osm;
                if (osm && d.user) {
                    selection = selection
                        .append('a')
                        .attr('class', 'comment-author-link')
                        .attr('href', osm.userURL(d.user))
                        .attr('tabindex', -1)
                        .attr('target', '_blank');
                }
                selection
                    .text(function(d) { return d.user || t('note.anonymous'); });
            });

        meta
            .append('div')
            .attr('class', 'comment-date')
            .text(function(d) { return d.action + ' ' + localeDateString(d.date); });

        main
            .append('div')
            .attr('class', function(d) {
                var trunc = (d.text.length > commentLimit);
                return 'comment-text' + (trunc ? ' truncated' : '');
            })
            .text(function(d) {
                var trunc = (d.text.length > commentLimit);
                return trunc ? d.text.slice(0, commentLimit) + '…' : d.text;
            });

        main
            .each(function(d) {
                var selection = d3_select(this);
                var trunc = (d.text.length > commentLimit);
                if (!trunc) return;

                selection
                    .append('a')
                    .attr('class', 'comment-toggle-more')
                    .attr('href', '#')
                    .attr('tabindex', -1)
                    .attr('target', '_blank')
                    .text(t('note.more'))
                    .on('click', toggleMore);
            });

        comments
            .call(replaceAvatars);
    }


    function toggleMore() {
        d3_event.preventDefault();

        var selection = d3_select(this.parentNode);  // select .comment-main
        var commentText = selection.selectAll('.comment-text');
        var commentToggle = selection.selectAll('.comment-toggle-more');
        var trunc = !commentText.classed('truncated');

        commentText
            .classed('truncated', trunc)
            .text(function(d) {
                return trunc ? d.text.slice(0, commentLimit) + '…' : d.text;
            });

        commentToggle
            .text(t('note.' + (trunc ? 'more' : 'less')));
    }


    function replaceAvatars(selection) {
        var osm = services.osm;
        if (!osm) return;

        var uids = {};  // gather uids in the comment thread
        _note.comments.forEach(function(d) {
            if (d.uid) uids[d.uid] = true;
        });

        Object.keys(uids).forEach(function(uid) {
            osm.user(uid, function(err, user) {
                if (!user || !user.image_url) return;

                selection.selectAll('.comment-avatar.user-' + uid)
                    .html('')
                    .append('img')
                    .attr('class', 'icon comment-avatar-icon')
                    .attr('src', user.image_url)
                    .attr('alt', user.display_name);
            });
        });
    }


    function newComment(selection) {
        if (!context.selectedNoteID()) return;
        // New Comment
        var saveSection = selection.selectAll('.save-section')
            .data([0]);

        saveSection = saveSection.enter()
            .append('div')
            .attr('class','save-section cf')
            .merge(saveSection);

        saveSection
            .call(saveHeader)
            .call(input)
            .call(buttons);
    }


    function saveHeader(selection) {
        var header = selection.selectAll('.notesSaveHeader')
            .data([0]);
        header = header.enter()
            .append('h4')
            .attr('class', '.notesSaveHeader')
            .text(t('note.newComment'))
            .merge(header);
    }


    function input(selection) {
        // Input
        var input = selection.selectAll('textarea')
            .data([0]);

        // enter
        input = input.enter()
            .append('textarea')
            .attr('id', 'new-comment-input')
            .attr('placeholder', t('note.inputPlaceholder'))
            .attr('maxlength', 1000)
            .call(utilNoAuto)
            .on('input', change(true))
            .on('blur', change())
            .on('change', change())
            .merge(input);


        function change(onInput) {
            return function() {
                dispatch.call('changeInput', this, onInput);
            };
        }
    }

    function buttons(selection) {
        // Buttons
        var buttonSection = selection.selectAll('.buttons')
            .data([0]);

        // enter
        var buttonEnter = buttonSection.enter()
            .append('div')
            .attr('class', 'buttons cf');

        buttonEnter
            .append('button')
            .attr('class', 'secondary-action button cancel-button')
            .append('span')
            .attr('class', 'label')
            .text(t('note.cancel'));

        buttonEnter
            .append('button')
            .attr('class', 'action button save-button')
            .append('span')
            .attr('class', 'label')
            .text(t('note.save'));

        var status;
        if (_note.status) {
            status = _note.status === 'open' ? t('note.close') : t('note.reopen');
        }

        buttonEnter
            .append('button')
            .attr('class', _note.status + '-button status-button action button')
            .append('span')
            .attr('class', 'label')
            .text(status);


        // update
        buttonSection = buttonSection
            .merge(buttonEnter);

        buttonSection.selectAll('.close-button')
            .on('click.close', function() {
                console.log('close button clicked');
            });

        buttonSection.selectAll('.reopen-button')
            .on('click.reopen', function() {
                console.log('reopen button clicked');
            });

        buttonSection.selectAll('.cancel-button')
            .on('click.cancel', function() {
                // var selectedID = commitChanges.entityID(); TODO: cancel note event
                // dispatch.call('cancel', this, selectedID);
            });

        buttonSection.selectAll('.save-button')
            .attr('disabled', function() {
                var n = d3_select('#new-comment-input').node();
                return (n && n.value.length) ? null : true;
            })
            .on('click.save', function() {
                this.blur();    // avoid keeping focus on the button - #4641
                // dispatch.call('saveNote', this, _newComment); TODO: saveNote event
            });
    }


    function render(selection) {
        var header = selection.selectAll('.header')
            .data([0]);

        header.enter()
            .append('div')
            .attr('class', 'header fillL')
            .append('h3')
            .text(t('note.title'));


        var body = selection.selectAll('.body')
            .data([0]);

        body = body.enter()
            .append('div')
            .attr('class', 'body')
            .merge(body);

        body.selectAll('.note-editor')
            .data([0])
            .enter()
            .append('div')
            .attr('class', 'modal-section note-editor')
            .call(noteHeader)
            .call(noteComments)
            .call(newComment);

    }


    noteEditor.note = function(_) {
        if (!arguments.length) return _note;
        _note = _;
        return noteEditor;
    };


    return utilRebind(noteEditor, dispatch, 'on');
}
