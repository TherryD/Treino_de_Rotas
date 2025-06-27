const db = require('../db');
const showdown = require('showdown');
const PDFDocument = require('pdfkit')
const removeMarkdown = require('remove-markdown');

//configuração do sanitizador de HTML
const createDOMPurify = require('dompurify')
const {JSDOM} = require('jsdom')
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

class NotaControlador {

    // --- Métodos para Renderizar páginas ---

    //Método para RENDERIZAR o dashboard
    async renderDashboard (req, res, next) {
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
            console.log(`Encontradas ${anotacoes.length} anotações para o usuárrio ${userId}.`) 
            res.render('dashboard', {
                usuario: req.session.user,
                anotacoes: anotacoes
            })
        } catch (error) {
            console.error('ERRO ao buscar anotações: ', error)
            next(error)
        }
    }

    // Método para RENDERIZAR a lixeira
    async renderTrash (req, res, next) {
        try{
            const userId = req.session.user.id
            const sql = "SELECT * FROM anotacoes WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC"
            const [anotacoes] = await db.query(sql, [userId])

            res.render('lixeira', {
                usuario: req.session.user,
                anotacoes: anotacoes
            })
        } catch (error){next(error)}
    }

    //Método MOSTRAR uma anotação específica
    async show(req, res, next) {
        try{
            const userId = req.session.user.id
            const notaId = req.params.nid 
            const sql =`
                SELECT anotacoes.*, GROUP_CONCAT(etiquetas.nome SEPARATOR ', ') AS tags
                FROM anotacoes
                LEFT JOIN anotacao_etiqueta ON anotacoes.id = anotacao_etiqueta.note_id
                LEFT JOIN etiquetas ON anotacao_etiqueta.tag_id = etiquetas.id
                WHERE anotacoes.id = ? AND anotacoes.user_id = ?
                GROUP BY anotacoes.id
            `
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

    // --- MÉTODOS DE AÇÃO

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

            if(tagsString && tagsString.trim() !== '') {
                const tagNames = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag)
                if(tagNames.length > 0) {
                    const espacosReser = tagNames.map(() => '?').join(',')
                    const [existingTags] = await connection.query(`SELECT id, nome FROM etiquetas WHERE nome IN (${espacosReser}) AND user_id = ?`, [...tagNames, userId])
                    const existingTagsMap = new Map(existingTags.map(t => [t.nome, t.id]))
                    const tagsToCreate = tagNames.filter(name => !existingTagsMap.has(name))
                    
                    for (const tagName of tagsToCreate) {
                        const [resultTag] = await connection.query("INSERT INTO etiquetas (nome, user_id) VALUES (?, ?)", [tagName, userId])
                        existingTagsMap.set(tagName, resultTag.insertId)
                    }
                    for(const tagName of tagNames) {
                        const tagId = existingTagsMap.get(tagName)
                        await connection.query("INSERT IGNORE INTO anotacao_etiqueta (note_id, tag_id) VALUES (?, ?)", [notaId, tagId])
                    }
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
                if(tagNames.length > 0) {
                    const espacosReser = tagNames.map(() => '?').join(',')
                    const [existingTags] = await connection.query(`SELECT id, nome FROM etiquetas WHERE nome IN (${espacosReser}) AND user_id = ?`, [...tagNames, uid])
                    const existingTagsMap = new Map(existingTags.map(t => [t.nome, t.id]))
                    const tagsToCreate = tagNames.filter(name => !existingTagsMap.has(name))

                    for(const tagName of tagsToCreate) {
                        const [resultTag] = await connection.query("INSERT INTO etiquetas (nome, user_id) VALUES (?, ?)", [tagName, uid])
                        existingTagsMap.set(tagName, resultTag.insertId)
                    }
                    for(const tagName of tagNames) {
                        const tagId = existingTagsMap.get(tagName)
                        await connection.query("INSERT INTO anotacao_etiqueta (note_id, tag_id) VALUES (?, ?)", [nid, tagId])
                    }
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
            const {uid, nid} = req.params
            const sql = "UPDATE anotacoes SET deleted_at = NOW() WHERE id = ? AND user_id = ?"
            await db.query(sql, [nid, uid])
            console.log(`Anotação ${nid} enviada para a lixeira. `)
            res.redirect(`/${uid}`)
        } catch (error) {next(error)}
    }

    //Método para RESTAURAR anotação da lixeira
    async restore (req, res, next) {
        try{
            const {nid, uid} = req.params
            const sql = "UPDATE anotacoes SET deleted_at = NULL WHERE id = ? AND user_id = ?"
            await db.query(sql, [nid, uid])
            console.log(`Anotação ${nid} restaurada com sucesso.`)
            res.redirect(`/${uid}/lixeira`)
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

    //Método para ENVIAR MÚLTIPLAS anotações para a lixeira
    async softDeleteMany (req, res, next) {
        try {
            const {uid} = req.params
            const {noteIds} = req.body

            if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
                return res.status(400).json({ success: false, message: 'Nenhum ID de anotação fornecido.' });
            }
            const sql = "UPDATE anotacoes SET deleted_at = NOW() WHERE id IN (?) AND user_id = ?";
            const [result] = await db.query(sql, [noteIds, uid]);
            console.log(`${result.affectedRows} anotações enviadas para a lixeira.`);
            res.json({ success: true, message: 'Anotações excluídas com sucesso.' });
        } catch (error) {next(error)}
    }

    // --- MÉTODOS DE EXPORTAÇÂO ---

    //Método para EXPORTAR para TXT
    async exportToTxt(req, res, next) {
        try {
            const userId = req.session.user.id;
            const sql = "SELECT * FROM anotacoes WHERE user_id = ? AND deleted_at IS NULL ORDER BY nome ASC";
            const [anotacoes] = await db.query(sql, [userId]);

            let fileContent = `Anotações de ${req.session.user.nome}\n`;
            fileContent += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
            fileContent += "=========================================\n\n";

            anotacoes.forEach(anotacao => {
                fileContent += `TÍTULO: ${anotacao.nome}\n`;
                fileContent += `-------------------------------\n`;
                // Usamos a lib 'remove-markdown' para limpar o texto
                fileContent += `${removeMarkdown(anotacao.descricao || 'Nenhuma descrição.')}\n\n`;
                fileContent += "==========================================\n\n";
            });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=anotacoes.txt');
            res.send(fileContent);
        } catch (error) {
            next(error);
        }
    }

    //Método para EXPORTAR para PDF 
    async exportToPdf(req, res, next) {
        try {
            const userId = req.session.user.id;
            const sql = `
                SELECT anotacoes.*, GROUP_CONCAT(etiquetas.nome SEPARATOR ', ') AS tags
                FROM anotacoes
                LEFT JOIN anotacao_etiqueta ON anotacoes.id = anotacao_etiqueta.note_id
                LEFT JOIN etiquetas ON anotacao_etiqueta.tag_id = etiquetas.id
                WHERE anotacoes.user_id = ? AND anotacoes.deleted_at IS NULL
                GROUP BY anotacoes.id 
                ORDER BY anotacoes.updated_at DESC
            `;
            const [anotacoes] = await db.query(sql, [userId]);
            const doc = new PDFDocument({ margin: 50 });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=anotacoes.pdf');

            doc.pipe(res);
            doc.fontSize(24).font('Helvetica-Bold').text('Minhas Anotações', { align: 'center' });
            doc.moveDown(2);

            anotacoes.forEach(anotacao => {
                doc.fontSize(18).font('Helvetica-Bold').text(anotacao.nome);
                doc.moveDown(0.5);

                if (anotacao.tags) {
                    doc.fontSize(10).font('Helvetica').fillColor('grey').text(`Etiquetas: ${anotacao.tags}`);
                    doc.moveDown(0.5);
                }
                
                doc.fillColor('black');
                
                // Limpa o markdown para o PDF
                const descricaoLimpa = removeMarkdown(anotacao.descricao || 'Nenhuma descrição.');
                
                doc.fontSize(12).font('Helvetica').text(descricaoLimpa, {align: 'justify'});
                doc.moveDown(1);
                doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
                doc.moveDown(1);
            });
            doc.end();
        } catch (error) {
            console.error("ERRO ao gerar PDF:", error);
            next(error);
        }
    }

}

module.exports = new NotaControlador();