const express = require('express')
const router = express.Router()
const userController = require('../controllers/user.controller')
const { route } = require('./user')

// --- ROTAS Públicas e de Autenticação ---

//Rota para a página inicial
router.get('/', (req, res) =>{
  res.render('index', {title: "Página Inicial"})
})

//Rotas de Login
router.get('/login', userController.renderLoginForm)
router.post('/login', userController.login)

//Rotas de Cadastro
router.get('/cadastro', userController.renderRegisterForm)
router.post('/cadstro', userController.register)

//Rota de Logout
router.get('/logout', userController.logout)

module.exports = router