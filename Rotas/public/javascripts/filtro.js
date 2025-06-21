document.addEventListener('DOMContentLoaded', () =>{
    const filtroInput = document.getElementById('filtro-anotacoes')

    if(filtroInput) {
        filtroInput.addEventListener('input', () =>{
            const anotacoes = document.querySelectorAll('.item-anotacao')
            const termoBusca = filtroInput.value.toLowerCase().trim()

            anotacoes.forEach(anotacao =>{
                const nomeAnotacao = anotacao.textContent.toLowerCase().trim()
                if(nomeAnotacao.includes(termoBusca)) {
                    anotacao.style.display = 'flex'
                } else {
                    anotacao.style.display = 'none'
                }
            })
        })
    }
})