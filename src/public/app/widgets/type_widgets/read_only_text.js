import treeCache from "../../services/tree_cache.js";
import AbstractTextTypeWidget from "./abstract_text_type_widget.js";
import treeService from "../../services/tree.js";
import libraryLoader from "../../services/library_loader.js";

const TPL = `
<div class="note-detail-readonly-text note-detail-printable">
    <style>
    /* h1 should not be used at all since semantically that's a note title */
    .note-detail-readonly-text h1 { font-size: 2.0em; }
    .note-detail-readonly-text h2 { font-size: 1.8em; }
    .note-detail-readonly-text h3 { font-size: 1.6em; }
    .note-detail-readonly-text h4 { font-size: 1.4em; }
    .note-detail-readonly-text h5 { font-size: 1.2em; }
    .note-detail-readonly-text h6 { font-size: 1.1em; }
    
    body.heading-style-markdown .note-detail-readonly-text h2::before { content: "##\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-text h3::before { content: "###\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-text h4:not(.include-note-title)::before { content: "####\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-text h5::before { content: "#####\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-text h6::before { content: "######\\2004"; color: var(--muted-text-color); }
    
    .note-detail-readonly-text {
        padding-left: 22px;
        padding-top: 10px;
        font-family: var(--detail-text-font-family);
        position: relative;
        min-height: 50px;
    }
        
    .note-detail-readonly-text p:first-child, .note-detail-readonly-text::before {
        margin-top: 0;
    }
    
    .note-detail-readonly-text img {
        max-width: 100%;
    }
    
    .edit-text-note-container {
        position: absolute; 
        top: 5px; 
        right: 10px;
    }
    </style>

    <div class="alert alert-warning no-print edit-text-note-container">
         <a href="#" class="edit-note">Edit</a> <a href="#" class="external" data-help-page="Read-only-note" title="Help on Read only notes">?</a>
    </div>

    <div class="note-detail-readonly-text-content ck-content"></div>
</div>
`;

export default class ReadOnlyTextTypeWidget extends AbstractTextTypeWidget {
    static getType() { return "read-only-text"; }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$content = this.$widget.find('.note-detail-readonly-text-content');

        this.$widget.find('a.edit-note').on('click', () => {
            this.tabContext.textPreviewDisabled = true;

            this.triggerEvent('textPreviewDisabled', {tabContext: this.tabContext});
        });

        super.doRender();
    }

    cleanup() {
        this.$content.html('');
    }

    async doRefresh(note) {
        // we load CKEditor also for read only notes because they contain content styles required for correct rendering of even read only notes
        // we could load just ckeditor-content.css but that causes CSS conflicts when both build CSS and this content CSS is loaded at the same time
        // (see https://github.com/zadam/trilium/issues/1590 for example of such conflict)
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        const noteComplement = await treeCache.getNoteComplement(note.noteId);

        this.$content.html(noteComplement.content);

        this.$content.find("a.reference-link").each(async (_, el) => {
            const notePath = $(el).attr('href');
            const noteId = treeService.getNoteIdFromNotePath(notePath);

            this.loadReferenceLinkTitle(noteId, $(el));
        });

        this.$content.find("section").each(async (_, el) => {
            const noteId = $(el).attr('data-note-id');

            this.loadIncludedNote(noteId, $(el));
        });

        if (this.$content.find('span.math-tex').length > 0) {
            await libraryLoader.requireLibrary(libraryLoader.KATEX);

            renderMathInElement(this.$content[0], {});
        }
    }

    async refreshIncludedNoteEvent({noteId}) {
        this.refreshIncludedNote(this.$content, noteId);
    }
}
