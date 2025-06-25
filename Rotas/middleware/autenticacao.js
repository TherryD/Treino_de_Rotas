//função que ferifica se o usuário está logado na sessão
function isAuthorized(req, res, next) {
    const userLogado = req.session.user
    const acessandoPropriaRota = req.session.user && req.session.user.id == req.params.uid

    if(userLogado && acessandoPropriaRota) {
        return next();
    }
    req.flash('error', 'Acesso não autorizado.')
    res.redirect('/login')
}

module.exports = {isAuthorized};