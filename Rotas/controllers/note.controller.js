const db = require('../db');
const showdown = require('showdown');

//configuração do sanitizador de HTML
const createDOMPurify = require('dompurify')
const {JSDOM} = require('jsdom')
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

class NotaControlador {

    // --- MÈTODOS GET --- 
    //Método MOSTRAR uma anotação específica
    async show(req, res, next) {
        try{
            const userId = req.session.user.id
            const notaId = req.params.nid 
            const sql = "SELECT * FROM anotacoes WHERE id = ? AND user_id = ?"
            const [anotacoes] = await db.query(sql, [notaId, userId])

            if(anotacoes.length > 0) {
                const anotacao = anotacoes[0]
                const converter = new showdown.Converter()

                const htmlSujo = converter.makeHtml(anotacao.descricao || '')
                const htmlLimpo = DOMPurify.sanitize(htmlSujo)

                anotacao.descricaoHtml = htmlLimpo
                res.render('ver_anotacao', {
                    usuario: req.session.user,
                    anotacao: anotacao
                })
            } else {return next()}
        } catch(error) {
            console.error("ERRO ao buscar a anotação.", error)
            next(error)
        }
    }
    //Método para RENDERIZAR o formulário de edição
    async renderEditForm(req, res, next) {
        try {
            const {uid, nid} = req.params
            const sql = `
                SELECT anotacoes.*, GROUP_CONCAT(etiquetas.nome) AS tags
                FROM anotacoes
                LEFT JOIN anotacao_etiqueta ON anotacoes.id = anotacao_etiqueta.note_id
                LEFT JOIN etiquetas ON anotacao_etiqueta.tag_id = etiquetas.id
                WHERE anotacoes.id = ? AND anotacoes.user_id = ?
                GROUP BY anotacoes.id 
            `
            const [anotacoes] = await db.query(sql, [nid, uid])

            if (anotacoes.length > 0){
                res.render('editar_anotacao', {
                    usuario: req.session.user,
                    anotacao: anotacoes[0]
                })
            } else {return next()}
        } catch (error) {next(error)}
    } 
    //Método que RENDERIZA a página de confirmação de exclusão
    async renderDeleteForm (req, res, next) {
        try{
            const {uid, nid} = req.params
            const [rows] = await db.query("SELECT * FROM anotacoes WHERE id = ? AND user_id = ?", [nid, uid])

            if (rows.length > 0) {
                const anotacao = rows[0]
                res.render('excluir_anotacao', {
                    usuario: req.session.user,
                    anotacao: anotacao
                })
            } else{return next()}
        } catch (error){next(error)}
    }
    // --- MÉTODOS POST
    //Método para CRIAR uma nova anotação
    async create(req, res, next) {
        if(!req.session.user) {
            req.flash('error', 'Você precisa estar logado para criar uma anotação.')
            return res.redirect('/login')
        }
        const {nome, descricao, etiquetas: tagsString} = req.body
        const userId = req.session.user.id
        const connection = await db.getConnection()

        try{
            await connection.beginTransaction()
            const sqlNota = "INSERT INTO anotacoes (nome, descricao, user_id) VALUES (?, ?, ?)"
            const [resultadoNota] = await connection.query(sqlNota, [nome, descricao, userId])
            const notaId = resultadoNota.insertId

            if(tagsString) {
                const tagNames = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag)
                for (const tagName of tagNames) {
                    let [rows] = await connection.query("SELECT id FROM etiquetas WHERE nome = ? AND user_id = ? ", [tagName, userId])
                    let tagId

                    if (rows.length > 0) {
                        tagId = rows[0].id 
                    } else{
                        const [resultTag] = await connection.query("INSERT INTO etiquetas (nome, user_id) VALUES (?, ?)", [tagName, userId])
                        tagId = resultTag.insertId
                    }
                    await connection.query("INSERT IGNORE INTO anotacao_etiqueta (note_id, tag_id) VALUES (?, ?)", [notaId, tagId])
                }
            }
            await connection.commit()
            console.log(`Nova anotação "${nome}" criada com sucesso para o usuário ${userId}.`)
            res.redirect(`/${userId}`)
        } catch (error) {
            await connection.rollback()
            console.error("ERRO ao criar anatação com tag:", error)
            next(error)
        } finally {
            connection.release()
        }
    }
    //Método para ATUALIZAR a anotação 
    async update(req, res, next) {
        const {uid, nid} = req.params
        const {nome, descricao, etiquetas: tagsString} = req.body
        const connection = await db.getConnection()

        try{
            await connection.beginTransaction()
            const sqlUpdateNota = "UPDATE anotacoes SET nome = ?, descricao = ? WHERE id = ? AND user_id = ?"
            await connection.query(sqlUpdateNota, [nome, descricao, nid, uid])
            
            await connection.query("DELETE FROM anotacao_etiqueta WHERE note_id = ?", [nid])

            if (tagsString && tagsString.trim() !== '') {
                const tagNames = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag)
                for(const tagName of tagNames) {
                    let[rows] = await connection.query("SELECT id FROM etiquetas WHERE nome = ? AND user_id = ?", [tagName, uid])
                    let tagId
                    if (rows.length > 0) {
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
            console.error("ERRO ao atualizar anotação com tag:", error)
            next(error)
        } finally {connection.release()}
    }
    
    //Método para ENVIAR a notação para a lixeira.
    async softDelete (req, res, next) {
        try{
            const {uid, nid} =req.params
            const sql = "UPDATE anotacoes SET deleted_at = NOW() WHERE id = ? AND user_id = ?"
            await db.query(sql, [nid, uid])
            console.log(`Anotação ${nid} enviada para a lixeira. `)
            res.redirect(`/${uid}`)
        } catch (error) {next(error)}
    }
    //Método para EXCLUIR permanentemente a anotação.
    async forceDelete (req, res, next) {
        try {
            const {uid, nid} = req.params
            const sql = "DELETE FROM anotacoes WHERE id = ? AND user_id = ?"
            await db.query(sql, [nid, uid])
            console.log(`Anotação ${nid} excluída permanentemente.`)
            res.redirect(`/${uid}/lixeira`)
        } catch (error){next(error)}
    }

}

module.exports = new NotaControlador();