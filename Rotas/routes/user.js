const express = require('express');
const router = express.Router()
const userController = require('../controllers/user.controller')
const {isAuthorized} = require('../middleware/autenticacao')

//Rota para a página de perfil
router.get('/:uid/perfil', isAuthorized, userController.renderPerfil)

//Rotas para editar o perfil
router.get('/:uid/perfil/editar', isAuthorized, userController.renderEditPerfil)
router.post('/:uid/perfil/editar', isAuthorized, userController.updatePerfil)

//Rotas para excluir o perfil
router.get('/:uid/perfil/excluir', isAuthorized, userController.renderDeletePerfil)
router.post('/:uid/perfil/excluir', isAuthorized, userController.deletePerfil)

module.exports = router;