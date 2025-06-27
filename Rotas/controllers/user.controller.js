const db = require('../db')
const bcrypt = require('bcrypt')
const Joi = require('joi')

class userController{
    //Método para RENDERIZAR a página cadastro
    renderRegisterForm(req, res, next) {
        res.render('cadastro', {title: 'Pagina de cadastro', messages: req.flash('error')})
    }

    //Método para PROCESSAR o formulário de cadastro
    async register(req, res, next) {
        const schema = Joi.object({
            nome: Joi.string().min(3).required().messages({
                'string.base': `Nome deve ser um texto`,
                'string.empty': `Nome não pode ser vazio`,
                'string.min': `Nome precisa ter mínimo {#limit} caracteres`,
                'any.required': `Nome é um campo obrigatório`
            }),
            email: Joi.string().email().required().messages({
                'string.email': `Email deve ser um endereço válido`,
                'any.required': `Email é um campo obrigatório`
            }),
            senha: Joi.string().min(8).required().messages({
                'string.min': `Senha precisa ter no mínimo {#limit} caracteres`,
                'any.required': `Senha é um campo obrigatório`
            })
        })
        const {error, value} = schema.validate(req.body, {abortEarly: false})
        if(error) {
            const errorMessages = error.details.map(detail => detail.message).join(', ')
            req.flash('error', errorMessages)
            return res.redirect('/cadastro')
        }
        try{
            const {nome, email, senha} = value
            const salt = await bcrypt.genSalt(10)
            const hash = await bcrypt.hash(senha, salt)

            const sql = "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)"
            await db.query(sql, [nome, email, hash])
            console.log("Usuário cadastrado com Sucesso!")
            res.redirect('/login')
        } catch (dbError) {
            if(dbError.code === 'ER_DUP_ENTRY'){
                req.flash('error', 'Este e-mail já está em uso. Tente outro.')
                return res.redirect('/cadastro')
            }
            next(dbError)
        }
    }

    //Método para RENDERIZAR a págin de login
    renderLoginForm(req, res, next) {
        res.render('login', {title: 'Login', messages: req.flash('error')})
    }

    //Método para PROCESSAR o formulário de login
    async login (req, res, next) {
        const schema = Joi.object({
            email: Joi.string().email().required(),
            senha: Joi.string().required()
        })
        const {error, value} = schema.validate(req.body)
        if (error) {
            req.flash('error', 'E-mail ou senha inválidos.')
            return res.redirect('/login')
        }
        try{
            const {email, senha} = value
            const sql = "SELECT * FROM usuarios WHERE email = ?"
            const [users] = await db.query(sql, [email])

            if (users.length === 0) {
                req.flash('error', 'E-mail ou senha inválidos.')
                return res.redirect('/login')
            }
            const user = users[0]
            const passwordMatch = await bcrypt.compare(senha, user.senha_hash)

            if (!passwordMatch) {
                req.flash('error', 'E-mail ou senha inválidos.')
                return res.redirect('/login')
            }
            console.log(`Login bem-sucedido para o usuário: ${user.nome}`)
            req.session.user = {id: user.id, nome: user.nome, email: user.email}
            res.redirect(`/${user.id}`)
        } catch (dbError) {
            console.error("ERRO durante o login", dbError)
            next(dbError)
        }
    }

    //Método para LOGOUT
    logout(req, res, next) {
        req.session.destroy(err =>{
            if (err) {return next(err)}
            res.redirect('/')
        })
    }

    //Método para RENDERIZAR a página de perfil
    renderPerfil (req, res, next) {
        res.render('perfil', {usuario: req.session.user})
    }

    //Método para RENDERIZAR o formulário de edição de perfil
    renderEditPerfil (req, res, next) {
        res.render('editar_perfil', {usuario: req.session.user})
    }

    //Método para ATUALIZAR os dados do perfil
    async updatePerfil (req, res, next) {
        const schema = Joi.object({
            nome: Joi.string().min(3).required().messages({
                'string.empty': `O nome não pode ser vazio.`,
                'string.min': `O nome precisa ter no mínimo {#limit} caracteres.`,
                'any.required': `O campo nome é obrigatório.`
            })
        })
        const {error, value} = schema.validate(req.body)
        if (error) {
            req.flash('error', error.details[0].message)
            return res.redirect(`/${req.params.uid}/perfil/editar`)
        }
        try{
            const {uid} = req.params
            const {nome} = value

            const sql = "UPDATE usuarios SET nome = ? WHERE id = ?"
            await db.query(sql, [nome, uid])
            req.session.user.nome = nome
            console.log(`Perfil do uuário ${uid} atualizado para "${nome}".`)
            res.redirect(`/${uid}/perfil`)
        } catch (dbError) {next(dbError)}
    }
    //Método para RENDERIZAR a págin de confirmação de exclusão
    renderDeletePerfil (req, res, next) {
        res.render('excluir_perfil', {usuario: req.session.user})

    }

    //Método para DELETAR o perfil do usuário
    async deletePerfil (req, res, next) {
        try{
            const {uid} = req.params
            const sql = "DELETE FROM usuarios WHERE id = ?"
            await db.query(sql, [uid])

            req.session.destroy(err =>{
                if (err) { return next(err)}
                res.redirect('/')
            })
        } catch (dbError){next(dbError)}
    }

}

module.exports = new userController