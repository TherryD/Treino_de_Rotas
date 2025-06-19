const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

// Rostas GET
router.get('/', function(req, res, next) {
  res.render('index', {title: "Página Inicial", messages: req.flash('error')});
});

router.get("/login", (req, res, next) =>{
  res.render('login', {title: 'Login', messages: req.flash('error')})
})

router.get("/cadastro", (req, res, next) =>{
  res.render('cadastro', {title: 'Pagina de cadastro', messages:req.flash('error')})
})

router.get("/criar", (req, res, next) =>{

})

router.get("/:uid", (req, res, next) =>{
  if (req.session.user && req.session.user.id == req.params.uid) {
    res.render('dashboard', {usuario: req.session.user})
  } else {
    req.flash('error', 'Você pricisa logar para entrar.')
    res.redirect('/login')
  }
  })

router.get("/:uid/:nid/excluir", (req, res, next) =>{

})

router.get("/:uid/:nid/editar", (req, res, next) =>{

})

// Rotas POST
router.post("/login",  async (req, res, next) =>{
  const {email, senha} = req.body

  try {
    const sql = "SELECT * FROM usuarios WHERE email = ?"
    const [users] = await db.query(sql, [email])

    if (users.length === 0) {
      req.flash('error', 'E-mail ou senha inválidos.')
      return res.redirect('/login')
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(senha, user.senha_hash)
  
    if (!passwordMatch) {
      req.flash('error', 'E-mail ou senha inválidos.')
      return res.redirect('/login')
    }

    console.log(`Login bem-sucedido para o usuário: ${user.nome}`)
    req.session.user = {
      id: user.id,
      nome: user.nome,
      email: user.email
    }
    res.redirect(`/${user.id}`)
  } catch (error) {
    console.error("ERRO durante o login", error)
    next(error)
  }

})
  
router.post("/cadastro", async(req, res, next) =>{
  const {nome, email, senha} = req.body

  if(!senha){
    return res.status(400).send("O campo senha não pode estar vazio.")
  }

  try{
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt)

    const sql = "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)"
    const values = [nome, email, hash]

    await db.query(sql, values)

    console.log("Usuário cadastrado com Sucesso!")
    res.redirect('/login')
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Este e-mail já está em uso. Tente outro')
      return res.redirect('/cadastro')
    }
    next(error)
  }
})

router.post("/:uid/:nid", (req, res, next) =>{

})

// Rota PUT
router.put("/:uid/:nid", (req, res, next) =>{

})

// Rota Delete
router.delete("/:uid/:nid", (req, res, next) =>{

})

module.exports = router;
