const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const showdown = require('showdown');
const PDFDocument = require('pdfkit');
const {isAuthorized} = require('../middleware/autenticacao')

const createDOMPurify = require('dompurify')
const {JSDOM} = require('jsdom')
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

const noteController = require('../controllers/note.controller');

// --- ROTAS GET ---
router.get('/', function(req, res, next) {
  res.render('index', {title: "Página Inicial", messages: req.flash('error')});
});

// rota GET para o login
router.get("/login", (req, res, next) =>{
  res.render('login', {title: 'Login', messages: req.flash('error')})
})

//rota GET para o cadastro
router.get("/cadastro", (req, res, next) =>{
  res.render('cadastro', {title: 'Pagina de cadastro', messages:req.flash('error')})
})

//rota GET para o criar anotação
router.get("/criar", (req, res, next) =>{
  if(req.session.user) {
    res.render('anotacao', {usuario: req.session.user})
  } else {
    req.flash('error','Você precisa precisa logar para estar na próxima página.')
    res.redirect('/login')
  }
})

//rota GET para o logout serve para voltar para a rota '/'
router.get('/logout', (req, res, next) =>{
  req.session.destroy(err =>{
    if(err){return next(err)}
    res.redirect('/')
  })
})

//rota GET para o perfil de um usuario (/:uid/perfil)
router.get('/:uid/perfil', isAuthorized, (req, res, next) =>{
  res.render('perfil', {usuario: req.session.user})
})

//rota GET para a lixeira (/:uid/lixeira)
router.get('/:uid/lixeira',isAuthorized, async (req, res, next) =>{
  try{
    const userId = req.session.user.id
    const sql = "SELECT * FROM anotacoes WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC "
    const [anotacoes] = await db.query(sql, [userId])

    res.render('lixeira', {
      usuario: req.session.user,
      anotacoes: anotacoes
    })
  } catch (error) {next(error)}
})

//rota GET para editar um perfil (/:uid/perfil/editar)
router.get('/:uid/perfil/editar',isAuthorized, (req, res, next) =>{
  res.render('editar_perfil', {usuario: req.session.user})
})

//rota GET para excluir um perfil (/:uid/perfil/excluir)
router.get("/:uid/perfil/excluir",isAuthorized, (req, res, next) =>{
  res.render('excluir_perfil', {usuario: req.session.user})
})

//rota GET para exportar em txt (/:uid/exportar/txt)
router.get('/:uid/exportar/txt',isAuthorized, async (req, res, next) =>{
  try{
    const userId = req.session.user.id
    const sql = "SELECT * FROM anotacoes WHERE user_id = ? AND deleted_at IS NULL ORDER BY nome ASC"
    const [anotacoes] = await db.query(sql, [userId])

    let fileContent = `Anotações de ${req.session.user.nome}\n`
    fileContent += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n\n`
    fileContent += "=========================================\n\n"

    anotacoes.forEach(anotacao =>{
      fileContent += `TÍTULO: ${anotacao.nome}\n`
      fileContent += `-------------------------------\n`
      fileContent += `${anotacao.descricao || 'Nenhuma descrição.'}\n\n`
      fileContent += "==========================================\n\n"
    })
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(fileContent)
  } catch (error) {next(error)}
})

//rota GET para exportar em pdf (/:uid/exportar/pdf)
router.get('/:uid/exportar/pdf',isAuthorized, async (req, res, next) =>{
  try{
    const userId = req.session.user.id
    const sql =`
      SELECT anotacoes.*, GROUP_CONCAT(etiquetas.nome SEPARATOR ', ') AS tags
      FROM anotacoes
      LEFT JOIN anotacao_etiqueta ON anotacoes.id = anotacao_etiqueta.note_id
      LEFT JOIN etiquetas ON anotacao_etiqueta.tag_id = etiquetas.id
      WHERE anotacoes.user_id = ? AND anotacoes.deleted_at IS NULL
      GROUP BY anotacoes.id 
      ORDER BY anotacoes.updated_at DESC
    `

    const[anotacoes] = await db.query(sql, [userId])
    const doc = new PDFDocument({margin: 50})

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=anotacoes.pdf')
      
    doc.pipe(res)
    doc.fontSize(24).font('Helvetica-Bold').text('Minhas Anotações', {align: 'center'})
    doc.moveDown(2)

    const converter = new showdown.Converter();

    anotacoes.forEach(anotacao =>{
      doc.fontSize(18).font('Helvetica-Bold').text(anotacao.nome)
      doc.moveDown(0.5)

      if (anotacao.tags) {
        doc.fontSize(10).font('Helvetica').fillColor('grey').text(`Etiquetas: ${anotacao.tags}`)
        doc.moveDown(0.5)
      }
        
      doc.fillColor('black')

      const descricaoHtml = converter.makeHtml(anotacao.descricao || '')
      const descricaoLimpa = descricaoHtml.replace(/<[^>]*>/g, '')
        
      doc.fontSize(12).font('Helvetica').text(descricaoLimpa)
      doc.moveDown(1)
      doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(1)
    })
    doc.end()
  } catch (error){
    console.error("ERRO ao gerar PDF:", error)
    next(error)}
})

//rota GET para excluir uma anotação (/:uid/:nid/excluir)
router.get("/:uid/:nid/excluir",isAuthorized, noteController.renderDeleteForm)

//rota GET para editar uma anotação (/:uid/:nid/editar)
router.get("/:uid/:nid/editar",isAuthorized, noteController.renderEditForm)

//rota GET
router.get("/:uid/:nid",isAuthorized, noteController.show )

//rota GET 
router.get("/:uid",isAuthorized, async (req, res, next) =>{
  try{
    const userId = req.session.user.id
    const sql = `
      SELECT anotacoes.*, GROUP_CONCAT(etiquetas.nome) AS tags
      FROM anotacoes
      LEFT JOIN anotacao_etiqueta ON anotacoes.id = anotacao_etiqueta.note_id
      LEFT JOIN etiquetas ON anotacao_etiqueta.tag_id = etiquetas.id
      WHERE anotacoes.user_id = ? AND anotacoes.deleted_at IS NULL
      GROUP BY anotacoes.id
      ORDER BY anotacoes.updated_at DESC
    `          
    const [anotacoes] = await db.query(sql, [userId])

    console.log(`Encontradas ${anotacoes.length} anotações para o usuário ${userId}.`)
    res.render('dashboard', {
      usuario: req.session.user,
      anotacoes: anotacoes 
    })
  } catch (error) {
    console.error('ERRO ao buscar anotações: ', error)
    next(error)
  }
})

// --- ROTAS POST ---
//rota POST para o login
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

//rota POST para o cadastro
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

//rota POST para criar anotação
router.post('/criar', noteController.create)

//rota POST para editar o perfil (/:uid/perfil/editar)
router.post('/:uid/perfil/editar',isAuthorized, async (req, res, next) =>{
  try {
    const {uid} = req.params
    const {nome} = req.body

    const sql = "UPDATE usuarios SET nome = ? WHERE id = ?"
    await db.query(sql, [nome, uid])

    req.session.user.nome = nome
    console.log(`Perfil do usuário ${uid} atualizado para "${nome}".`)
    res.redirect(`/${uid}`)
  } catch (error) {next(error)}
})

//rota POST para editar um perfil (/:uid/perfil/excluir)
router.post('/:uid/perfil/excluir',isAuthorized, async (req, res, next) =>{
  try{
    const {uid} = req.params

    const sql = "DELETE FROM usuarios WHERE id = ?"
    await db.query(sql, [uid])

    req.session.destroy(err =>{
      if(err){return next(err)}
      res.redirect('/')
      })
  } catch(error){next(error)}
})

//rota POST para excluir todas as anotações (/:uid/anotacoes/excluir-todos)
router.post('/:uid/anotacoes/excluir-todos',isAuthorized, async (req, res, next) =>{
  try{
    const {uid} = req.params
    const {noteIds} = req.body

    if(!noteIds || !Array.isArray(noteIds) || noteIds.length === 0 ) {
      return res.status(400).json({success: false, message: 'Nenhum ID de anotação fornecido.'})
    }
    const sql = "UPDATE anotacoes SET deleted_at = NOW() WHERE id IN (?) AND user_id = ?"
    const [result] = await db.query(sql, [noteIds, uid])
    console.log(`${result.affectedRows} anotações enviadas para a lixeira.`)
    res.json({success: true, message: 'Anotações excluídas com sucesso.'})
  } catch (error){next(error)}
})

//rota POST para excluir uma anotação (/:uid/:nid/excluir)
router.post('/:uid/:nid/excluir',isAuthorized, noteController.softDelete)

//rota POST para editar uma anotação (/:uid/:nid/editar)
router.post('/:uid/:nid/editar',isAuthorized, noteController.update)

//rota POST para restaurar uma anotação (/:uid/:nid/restaurar)
router.post("/:uid/:nid/restaurar",isAuthorized, async (req, res, next) =>{
  try {
    const {uid, nid} = req.params
    const sql = "UPDATE anotacoes SET deleted_at = NULL WHERE id = ? AND user_id = ?"
    await db.query(sql, [nid, uid]);

    console.log(`Anotação ${nid} restaurada com sucesso.`)
    res.redirect(`/${uid}/lixeira`)
  } catch (error){next(error)}
})

//rota POST para excluir permanente uma anotação (/:uid/:nid/excluir-permanente)
router.post('/:uid/:nid/excluir-permanente',isAuthorized, noteController.forceDelete)

module.exports = router;
