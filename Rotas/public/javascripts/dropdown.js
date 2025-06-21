document.addEventListener('DOMContentLoaded', () =>{
    const allDropdownToggles = document.querySelectorAll('.dropdown-toggle')

    allDropdownToggles.forEach(toggle =>{
        toggle.addEventListener('click', event =>{
            event.stopPropagation()
            closeAllDropdowns(toggle)
            toggle.nextElementSibling.classList.toggle('active')
        })
    })
})

// Função para fechar todos os menus abertos, exceto o atual
function closeAllDropdowns(exceptThisToggle) {
    const openMenus = document.querySelectorAll('.dropdown-menu.active')
    openMenus.forEach(menu =>{
        if(menu.previousElementSibling !== exceptThisToggle) {
            menu.classList.remove('active')
        }
    })
}

// fechar os menus se o usuário clicar fora
window.addEventListener('click', () =>{
    closeAllDropdowns(null)
})