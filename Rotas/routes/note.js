const express = require('express')
const router = express.Router()
const noteController = require('../controllers/note.controller')
const {isAuthorized} = require('../middleware/autenticacao')


//Rota para o formulário de criar anotação
router.get('/criar', (req, res) =>{
    if (req.session.user) {
        res.render('anotacao', {usuario: req.session.user})
    } else{
        req.flash('error', "Você precisa estar logado para acessar esta página.")
        res.redirect('/login')
    }
    
})

//Rota para processar a criação da anotação
router.post('/criar', noteController.create)

//Rota para o Dashboard
router.get('/:uid', isAuthorized, noteController.renderDashboard)


//Rota para a lixeira 
router.get('/:uid/lixeira', isAuthorized, noteController.renderTrash)

//Rotas para exportação
router.get('/:uid/exportar/txt', isAuthorized, noteController.exportToTxt)
router.get('/:uid/exportar/pdf', isAuthorized, noteController.exportToPdf)

//Rota para excluir tudo
router.post('/:uid/anotacoes/excluir-todos', isAuthorized, noteController.softDeleteMany)


// --- Rotas para uma anotação específica ---

//Rota para ver uma anotação
router.get('/:uid/:nid', isAuthorized, noteController.show)

//Rotas para editar uma anotação
router.get('/:uid/:nid/editar', isAuthorized, noteController.renderEditForm)
router.post('/:uid/:nid/editar', isAuthorized, noteController.update)

//Rotas para excluir uma anotação (enviar para lixeira)
router.get('/:uid/:nid/excluir', isAuthorized, noteController.renderDeleteForm)
router.post('/:uid/:nid/excluir', isAuthorized, noteController.softDelete)

//Rota para restaurar uma anotação da lixeira
router.post('/:uid/:nid/restaurar', isAuthorized, noteController.restore)

//Rota para excluir permanentemente uma anotação
router.post('/:uid/:nid/excluir-permanente', isAuthorized, noteController.forceDelete)

module.exports = router;