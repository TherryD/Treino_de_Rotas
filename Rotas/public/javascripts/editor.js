document.addEventListener('DOMContentLoaded', function(){
    const easymde = new EasyMDE({
        element: document.getElementById('descricao'),
        spellChecker: false,
        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "orered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen"]
    })
})