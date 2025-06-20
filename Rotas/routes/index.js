const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const showdown = require('showdown');

// --- ROTAS GET ---
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
  if(req.session.user) {
    res.render('anotacao', {usuario: req.session.user})
  } else {
    req.flash('error','Você precisa precisa logar para estar na próxima página.')
    res.redirect('/login')
  }
})

router.get('/:uid/lixeira', async (req, res, next) =>{
  try{
    if (req.session.user && req.session.user.id == req.params.uid) {
      const userId = req.session.user.id
      const sql = "SELECT * FROM anotacoes WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC "
      const [anotacoes] = await db.query(sql, [userId])

      res.render('lixeira', {
        usuario: req.session.user,
        anotacoes: anotacoes
      })
    } else {
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) {next(error)}
})

router.get('/:uid/perfil/editar', (req, res, next) =>{
  if (req.session.user && req.session.user.id == req.params.uid) {
    res.render('editar_perfil', {usuario: req.session.user})
  } else{
    req.flash('error', 'Acesso não autorizado.')
    res.redirect('/login')
  }
})

router.get("/:uid/:nid/excluir", async (req, res, next) =>{
  try {
    if (req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params
      const [rows] = await db.query("SELECT * FROM anotacoes WHERE id = ? AND user_id = ? ", [nid, uid])
      
      if (rows.length > 0) {
        const anotacao = rows[0]
        res.render('excluir_anotacao', {
          usuario: req.session.user,
          anotacao: anotacao
        })
      } else { return next()
      }
    } else{
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) {
    next(error)
  }
})

router.get("/:uid/:nid/editar", async (req, res, next) =>{
  try {
    if(req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params;
      const sql = "SELECT * FROM anotacoes WHERE id = ? AND user_id = ?"
      const [anotacoes] = await db.query(sql, [nid, uid])

      if (anotacoes.length > 0) {
        res.render('editar_anotacao', {
          usuario: req.session.user,
          anotacao: anotacoes[0]
        })
      } else {
        return next()
      }
    } else {
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) {
    next(error)
  }

})

router.get("/:uid/:nid", async (req, res, next) =>{
  try {
    if(req.session.user && req.session.user.id == req.params.uid) {
      const userId = req.session.user.id
      const notaId = req.params.nid
      const sql = "SELECT * FROM anotacoes WHERE id = ? AND user_id = ? "
      const [anotacoes] = await db.query(sql, [notaId, userId])

      if (anotacoes.length > 0) {
        const anotacao = anotacoes[0]
        const converter = new showdown.Converter()
        anotacao.descricaoHtml = converter.makeHtml(anotacao.descricao)
        res.render('ver_anotacao', {
          usuario: req.session.user,
          anotacao: anotacao
        })
      } else {
        return next()
      }
    } else {
      req.flash('error', 'Você precisa precisa estar logado para ver está página.')
      res.redirect('/login')
    } 
  } catch (error) {
    console.error("ERRO ao buscar a anotação.", error)
    next(error)
  }
})

router.get("/:uid", async (req, res, next) =>{
  try{
    if (req.session.user && req.session.user.id == req.params.uid){
      const userId = req.session.user.id

      const sql = "SELECT * FROM anotacoes WHERE user_id  = ? AND deleted_at IS NULL ORDER BY updated_at DESC"
      const [anotacoes] = await db.query(sql, [userId])

      console.log(`Encontradas ${anotacoes.length} anotações para o usuário ${userId}.`)
      res.render('dashboard', {
        usuario: req.session.user,
        anotacoes: anotacoes 
      })
    } else {
      req.flash('error', 'Você precisa logar para estar na próxima página.')
      res.redirect('/login')
    }
  } catch (error) {
    console.error('ERRO ao buscar anotações: ', error)
    next(error)
  }
})

// --- ROTAS POST ---
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

router.post('/criar', async (req, res, next) =>{
  if (!req.session.user) {
    req.flash('error', 'Você precisa precisa estar logado para criar uma anotação.')
    return res.redirect('/login')
  }

  try{
    const {nome, descricao} = req.body
    const userId = req.session.user.id
    const sql = "INSERT INTO anotacoes (nome, descricao, user_id) VALUES (?, ?, ?)"
    const values = [nome, descricao, userId]

    await db.query(sql, values)

    console.log(`Nova anotação "${nome}" criada para o usuário ${userId}.`)
    res.redirect(`/${userId}`)
  } catch (error) {
    console.error("ERRO ao criar anotação:", error)
    next(error)
  }
})

router.post('/:uid/:nid/excluir', async (req, res, next) =>{
  try{
    if(req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params

      const sql = "UPDATE anotacoes SET deleted_at = NOW() WHERE id = ? AND user_id = ?"
      await db.query(sql, [nid, uid])
      console.log(`Anotação ${nid} enviada para a lixeira.`)
      res.redirect(`/${uid}`)
    } else {
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) { next(error)
  }
})

router.post('/:uid/:nid/editar', async (req, res, next) =>{
  try {
    if (req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params
      const {nome, descricao} = req.body
      const sql = "UPDATE anotacoes SET nome = ?, descricao = ? WHERE id = ? AND user_id = ?"
      const values = [nome, descricao, nid, uid]

      await db.query(sql, values)
      console.log(`Anotação ${nid} atualizada com sucesso`)

      res.redirect(`/${uid}/${nid}`)
    } else {
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) {
    next(error)
  }
})

router.post("/:uid/:nid/restaurar", async (req, res, next) =>{
  try {
    if (req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params
      const sql = "UPDATE anotacoes SET deleted_at = NULL WHERE id = ? AND user_id = ?"
      await db.query(sql, [nid, uid]);

      console.log(`Anotação ${nid} restaurada com sucesso.`)
      res.redirect(`/${uid}/lixeira`)
    } else {
      req.flash('error', 'Acesso não autorizado. ')
      res.redirect('/login')
    }
  } catch (error){next(error)}
})

router.post('/:uid/:nid/excluir-permanente', async (req, res, next) =>{
  try{
    if (req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params
      const sql = "DELETE FROM anotacoes WHERE id = ? AND user_id = ?"
      await db.query(sql, [nid, uid])

      console.log(`Anotação ${nid} excluída permanentemente.`)
      res.redirect(`/${uid}/lixeira`)
    } else {
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) {next(error)}
})

router.post('/:uid/perfil/editar', async (req, res, next) =>{
  try {
    if (req.session.user && req.session.user.id == req.params.uid) {
      const {uid} = req.params
      const {nome} = req.body

      const sql = "UPDATE usuarios SET nome = ? WHERE id = ?"
      await db.query(sql, [nome, uid])

      req.session.user.nome = nome
      console.log(`Perfil do usuário ${uid} atualizado para "${nome}".`)
      res.redirect(`/${uid}`)
    } else {
      req.flash('error', "Acesso não autorizado.")
      res.redirect('/login')
    }
  } catch (error) {next(error)}
})

// --- ROTA PUT ---
router.put("/:uid/:nid", (req, res, next) =>{

})

// --- ROTA DELETE ---
router.delete("/:uid/:nid", (req, res, next) =>{

})

module.exports = router;
