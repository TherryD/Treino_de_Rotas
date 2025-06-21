document.addEventListener('DOMContentLoaded', () =>{
    const checkboxes = document.querySelectorAll('.checkbox')
    const acoesContainer = document.getElementById('acoes-container')
    const btnExcluir = document.getElementById('btn-excluir-selecionadas')
    const userId = document.body.dataset.userId

    // função para verificar se aguma checkbox está marcado.
    function verificarSelecao() {
        const algumMarcado = Array.from(checkboxes).some(cb => cb.checked)
        acoesContainer.style.display = algumMarcado ? 'block' : 'none'
    }

    checkboxes.forEach(cb =>{
        cb.addEventListener('change', verificarSelecao)
    })
    btnExcluir.addEventListener('click', async() =>{
        const idsSelecionados = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.noteId)
        if (idsSelecionados.length === 0) {
            alert('Nenhuma anotação selecionada.')
            return
        }

        if (confirm(`Tem certeza que deseja enviar ${idsSelecionados.length} anotação(ões) para a lixeira?`)) {
            try {
                const response = await fetch(`/${userId}/anotacoes/excluir-todos`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({noteIds: idsSelecionados})
                })

                if(response.ok) {
                    window.location.reload()
                } else {alert('Ocorreu um erro ao excluir as anotações.')}
            } catch (error) {
                console.error('ERRO:', error)
                alert('Ocorreu um erro de conexão.')
            }
        }
    })
})