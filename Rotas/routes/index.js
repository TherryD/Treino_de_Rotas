const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const showdown = require('showdown');
const PDFDocument = require('pdfkit');

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
router.get('/:uid/perfil', (req, res, next) =>{
  if (req.session.user && req.session.user.id == req.params.uid) {
    res.render('perfil', {usuario: req.session.user})
  } else{
    req.flash('error', 'Acesso não autorizado.')
    res.redirect('/login')
  }
})

//rota GET para a lixeira (/:uid/lixeira)
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

//rota GET para editar um perfil (/:uid/perfil/editar)
router.get('/:uid/perfil/editar', (req, res, next) =>{
  if (req.session.user && req.session.user.id == req.params.uid) {
    res.render('editar_perfil', {usuario: req.session.user})
  } else{
    req.flash('error', 'Acesso não autorizado.')
    res.redirect('/login')
  }
})

//rota GET para excluir um perfil (/:uid/perfil/excluir)
router.get("/:uid/perfil/excluir", (req, res, next) =>{
  if(req.session.user && req.session.user.id == req.params.uid) {
    res.render('excluir_perfil', {usuario: req.session.user})
  }else{
    req.flash('error', 'Acesso não autorizado.')
    res.redirect('/login')
  }
})

//rota GET para exportar em txt (/:uid/exportar/txt)
router.get('/:uid/exportar/txt', async (req, res, next) =>{
  try{
    if(req.session.user && req.session.user.id == req.params.uid) {
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
    } else {
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) {next(error)}
})

//rota GET para exportar em pdf (/:uid/exportar/pdf)
router.get('/:uid/exportar/pdf', async (req, res, next) =>{
  try{
    if(req.session.user && req.session.user.id == req.params.uid) {
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
      doc.fontSize(24).font('Helvetica-bold').text('Minhas Anotações', {align: 'center'})
      doc.moveDown(2)

      anotacoes.forEach(anotacao =>{
        doc.fontSize(18).font('Helvetica-bold').text(anotacao.nome)
        doc.moveDown(0.5)

        if (anotacao.tags) {
          doc.fontSize(10).font('Helvetica').fillColor('grey').text(`Etiquetas: ${anotacao.tags}`)
          doc.moveDown(0.5)
        }

        doc.fontSize(12).font('Helvetica').fillColor('black').text(anotacao.descricao || '')
        doc.moveDown(1)
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      })
      doc.end()
    } else{
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error){next(error)}
})

//rota GET para excluir uma anotação (/:uid/:nid/excluir)
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

//rota GET para editar uma anotação (/:uid/:nid/editar)
router.get("/:uid/:nid/editar", async (req, res, next) =>{
  try {
    if(req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params;
      const sql = `
        SELECT
          anotacoes.*,
          GROUP_CONCAT(etiquetas.nome) AS tags
        FROM
          anotacoes
        LEFT JOIN
          anotacao_etiqueta ON anotacoes.id = anotacao_etiqueta.note_id
        LEFT JOIN 
          etiquetas ON anotacao_etiqueta.tag_id = etiquetas.id
        WHERE
          anotacoes.id = ? AND anotacoes.user_id = ?
        GROUP BY
          anotacoes.id
      `
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

//rota GET
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

//rota GET 
router.get("/:uid", async (req, res, next) =>{
  try{
    if (req.session.user && req.session.user.id == req.params.uid){
      const userId = req.session.user.id
      const sql = `
        SELECT 
          anotacoes.*, 
          GROUP_CONCAT(etiquetas.nome) AS tags
        FROM 
          anotacoes
        LEFT JOIN
          anotacao_etiqueta ON anotacoes.id = anotacao_etiqueta.note_id
        LEFT JOIN
          etiquetas ON anotacao_etiqueta.tag_id = etiquetas.id
        WHERE
          anotacoes.user_id = ? AND anotacoes.deleted_at IS NULL
        GROUP BY
          anotacoes.id
        ORDER BY
          anotacoes.updated_at DESC
        `          
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
router.post('/criar', async (req, res, next) =>{
  if (!req.session.user) {
    req.flash('error', 'Você precisa precisa estar logado para criar uma anotação.')
    return res.redirect('/login')
  }
  const {nome, descricao, etiquetas: tagsString} = req.body
  const userId = req.session.user.id
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    const sqlNota = "INSERT INTO anotacoes (nome, descricao, user_id) VALUES (?, ?, ?)"
    const [resultadoNota] = await connection.query(sqlNota, [nome, descricao, userId])
    const notaId = resultadoNota.insertId

    if (tagsString) {
      const tagNames = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag)
      for (const tagName of tagNames) {
        let [rows] = await connection.query("SELECT id FROM etiquetas WHERE nome = ? AND user_id = ?", [tagName, userId])
        let tagId

        if (rows.length > 0) {
          tagId = rows[0].id 
        } else {
          const [resultTag] = await connection.query("INSERT INTO etiquetas (nome, user_id) VALUES (?, ?)", [tagName, userId])
          tagId = resultTag.insertId
        }
        await connection.query("INSERT IGNORE INTO anotacao_etiqueta (note_id, tag_id) VALUES (?, ?)", [notaId, tagId] )
      }
    }
    await connection.commit()
    console.log(`Nova anotação "${nome}" criada com sucesso para o usuário ${userId}.`)
    res.redirect(`/${userId}`)

  } catch(error) {
    await connection.rollback()
    console.error("ERRO ao criar anotação com tags:", error)
    next(error)
    
  } finally{connection.release()}
})

//rota POST para editar o perfil (/:uid/perfil/editar)
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

//rota POST para editar um perfil (/:uid/perfil/excluir)
router.post('/:uid/perfil/excluir', async (req, res, next) =>{
  try{
    if(req.session.user && req.session.user.id == req.params.uid) {
      const {uid} = req.params

      const sql = "DELETE FROM usuarios WHERE id = ?"
      await db.query(sql, [uid])

      req.session.destroy(err =>{
        if(err){
          return next(err)
        }
        res.redirect('/')
      })
    } else{
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch(error){next(error)}
})

//rota POST para excluir todas as anotações (/:uid/anotacoes/excluir-todos)
router.post('/:uid/anotacoes/excluir-todos', async (req, res, next) =>{
  try{
    if(req.session.user && req.session.user.id == req.params.uid) {
      const {uid} = req.params
      const {noteIds} = req.body

      if(!noteIds || !Array.isArray(noteIds) || noteIds.length === 0 ) {
        return res.status(400).json({success: false, message: 'Nenhum ID de anotação fornecido.'})
      }
      const sql = "UPDATE anotacoes SET deleted_at = NOW() WHERE id IN (?) AND user_id = ?"
      const [result] = await db.query(sql, [noteIds, uid])
      console.log(`${result.affectedRows} anotações enviadas para a lixeira.`)
      res.json({success: true, message: 'Anotações excluídas com sucesso.'})
    } else {
      res.status(403).json({success: false, message: 'Acesso não autorizado.'})
    }
  } catch (error){next(error)}
})

//rota POST para excluir uma anotação (/:uid/:nid/excluir)
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

//rota POST para editar uma anotação (/:uid/:nid/editar)
router.post('/:uid/:nid/editar', async (req, res, next) =>{
  try {
    if (req.session.user && req.session.user.id == req.params.uid) {
      const {uid, nid} = req.params
      const {nome, descricao, etiquetas: tagsString} = req.body
      const sql = "UPDATE anotacoes SET nome = ?, descricao = ? WHERE id = ? AND user_id = ?"
      const values = [nome, descricao, nid, uid]
      const connection = await db.getConnection()

      try{
        await connection.beginTransaction()
        const sqlUpdateNota = "UPDATE anotacoes SET nome = ?, descricao = ? WHERE id = ? AND user_id = ?"
        await connection.query(sqlUpdateNota, [nome, descricao, nid, uid])
        await connection.query("DELETE FROM anotacao_etiqueta WHERE note_id = ?", [nid])
      
        if (tagsString && tagsString.trim() !== '') {
          const tagNames = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag)

          for(const tagName of tagNames) {
            let [rows] = await connection.query("SELECT id FROM etiquetas WHERE nome = ? AND user_id = ?", [tagName, uid])
            let tagId

            if(rows.length > 0) {
              tagId = rows[0].id
            } else {
              const [resultTag] = await connection.query("INSERT INTO etiquetas (nome, user_id) VALUES (?, ?)", [tagName, uid])
              tagId = resultTag.insertId
            }

            await connection.query("INSERT INTO anotacao_etiqueta (note_id, tag_id) VALUES (?, ?)", [nid, tagId])
          }
        }

        await connection.commit()
        console.log(`Anotação ${nid} e suas etiquetas foram atualizadas com sucesso.`)
        res.redirect(`/${uid}/${nid}`)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {connection.release()}
    } else {
      req.flash('error', 'Acesso não autorizado.')
      res.redirect('/login')
    }
  } catch (error) {
    console.error("ERRO ao atualizar anotação com tags:", error)
    next(error)
  }
})

//rota POST para restaurar uma anotação (/:uid/:nid/restaurar)
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

//rota POST para excluir permanente uma anotação (/:uid/:nid/excluir-permanente)
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

module.exports = router;
