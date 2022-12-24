// Importando biblioteca para a inicialização do servidor
const express = require('express');
const app = express();

// Importando bilioteca para realizar a configuração das requisições entre o Front-End e o Back-End
const cors = require('cors');

// Importando biblioteca para que o body da requisição seja convertido em vários formatos
const bodyParser = require("body-parser");

// Importando biblioteca para criptografar a senha enviada ao Banco de Dados
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Importando biblioteca para o instanciamento da sessão do usuário e a sintonização do Cookie em um formato de fácil interpretação pelo servidor e também pelo Browser
const session = require('express-session');
const cookieParser = require('cookie-parser');

// Importando biblioteca para evitar que armazenaento dos dados da sessão acabe estourando, com essa biblioteca os dados armazenados serão controlados
const MemoryStore = require('memorystore')(session)

// Importando biblioteca para gerar o Token
const jwt = require('jsonwebtoken');

// Middleware responsável pelo armazenamento e validação do tipo de imagem recebida do Front-End
const uploadImage = require('./middlerares/uploadImage');

// Importando biblioteca que servirá para excluir arquivos internos do servidor
const fs = require('fs');

// Importando biblioteca para fazer a conexão com o Banco de Dados
const mysql = require('mysql2');

// Importando biblioteca para fazer a conexão com apis do Google, como é o caso do Google Drive
const { google } = require('googleapis');

// Url da pasta onde as imagens salvas serão adicionadas
const GOOGLE_API_FOLDER_ID = '14hlj7OEmep3ZONWrzmCKqQmPhn2s1gTK';

// Realizando a autenticação com o Google Drive
const auth = new google.auth.GoogleAuth({
    keyFile: './googledrive.json',
    scopes: ['https://www.googleapis.com/auth/drive']
});

// Se conectando ao Google Drive
const driveService = google.drive({
    version: 'v3',
    auth
});

// Porta padrão do servidor
const PORT = 3001;

// Função que análisa os dados de entrada de formato JSON dentro do servidor
app.use(express.json());

// Estabelecendo as configurações e os parâmetros necessários para a realização das requisições entre o Fron-End e o Back-End
app.use(cors({
    origin: ["https://celebrated-peony-4b8226.netlify.app", "https://site-services.onrender.com"],
    methods: ["POST", "GET", "PATCH", "DELETE"],
    credentials: true,
}));

// Instanciamento de biblioteca que facilita a leitura e interpretação do navegador em relação aos cookies recebidos
app.use(cookieParser());

// Configurando o recebimento de dados para que mantenham um mesmo formato
app.use(bodyParser.urlencoded({ extended: true }));

// Sintonizando a transição entre os dados do Front-End e do Back-End, para que a conexão entre as partes e a transição entre os dados seja estabelecida
app.set("trust proxy", 1);

// Passando os parâmetros para a criação da sessão
app.use(session({
    name: 'userId',
    secret: 'fnsdhfbssljkcsdffdsdkfn',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1000000
    },
    store: new MemoryStore({
        checkPeriod: 1000000
    })
}));

// Estabelecendo conexão com o Banco de Dados
const db = mysql.createPool({
    host: 'containers-us-west-166.railway.app',
    user: 'root',
    password: 'TrtJ5X5oZEMoJe46MhLy',
    port: '6646',
    database: 'railway'
});

// Criação da Rota de vai receber os dados do Cadastro do Front-End e manda-los para o Banco de Dados, assim deixando os dados salvos e o usuário cadastrado no sistema
app.post("/cadastro", (req, res) => {
    const { nome } = req.body;
    const { email } = req.body;
    const { senha } = req.body;

    // Verificando no Banco de Dados se o email recebido já existe ou não
    let sqlVerificar = "SELECT * FROM usuarios WHERE email = ?;";

    db.query(sqlVerificar, [email], (err, result) => {
        if (err) {
            console.log(err)
        }
        // Se o email recebido não existir, o cadastro será realizado
        if (result.length === 0) {
            // Com o email podendo ser cadastrado, a senha será encriptada
            bcrypt.hash(senha, saltRounds, (errorHash, hash) => {
                if (errorHash) {
                    console.log(errorHash);
                } else {
                    // Tendo o email e senha processados, agora serão inseridos no Banco de Dados
                    let sqlInsert = "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?);";

                    db.query(sqlInsert, [nome, email, hash], (error, response) => {
                        if (error) {
                            console.log(error)
                        } else {
                            res.send({ cadastrado: true, tipoMsg: "correto", msg: "Dados Cadastrados com Sucesso" });
                        }
                    });
                }
            });
            // Se o email recebido já existir, então não será cadastrado
        } else {
            res.send({ cadastrado: false, tipoMsg: "erro", msg: "Email já cadastrado" });
        }
    });
});

// Criação da Rota que vai receber os dados do usuário, analisar se são válidos em relação aos que existem no Banco de Dados e enviar uma resposta para a efetivação ou não do login
app.post("/login", (req, res) => {
    const { email } = req.body;
    const { senha } = req.body;

    // Verificar se o email recebido existe ou não no Banco de Dados
    let sqlVerificar = "SELECT * FROM usuarios WHERE email = ?;";

    db.query(sqlVerificar, [email], (error, result) => {
        if (error) {
            console.log(error)
        }
        // Se o email recebido existir, quer dizer que há aquele usuário já cadastrado, assim passando por um dos passos para a validação do Login
        if (result.length > 0) {
            // Depois do email ser confirmado, tem que ser analisado a senha que está sendo recebida, com isso vai ser realizado um processso de comparação entre a senha recebida e a que está salva no Banco de Dados.
            // Com base em um processo de desencriptação, vai ser analisada se as duas senhas são iguais.
            bcrypt.compare(senha, result[0].senha, (errorCompare, response) => {
                if (errorCompare) {
                    console.log(errorCompare)
                }
                // Com o email e senha confirmados, a sessão será iniciada
                if (response) {
                    // Será criado um Token para a sessão
                    const id = result[0].idusuarios
                    const token = jwt.sign({ id }, 'senhaSecretJWT', {
                        expiresIn: '24h'
                    });

                    // Agora será validado depois que o email e senha foram confirmados, qual o tipo de sessão que vai ser ativada, a sessão do Usuário ou do Administrador.
                    // Para isso, os dados vão ser passados por uma condicional:
                    // - Se o email existente for admin@admin.com, então foi o Administrador que realizou o login, assim os seus dados serão enviados para o Front-End;
                    // - Mas se não for esse email em específico logado, quer dizer que foi um email comum de Usuário, assim os dados daquele Usuário serão enviados para o Front-End
                    if (result[0].email === 'admin@admin.com') {
                        req.session.admin = result;
                        res.send({ loginAdmin: true, token: token, admin: result });
                    } else {
                        req.session.user = result;
                        res.send({ loginUser: true, token: token, user: result });
                    }
                    // Caso a senha recebida não seja igual a que está salva no Banco de Dados, então a sessão do usuário ou do administrador não será ativa
                } else {
                    res.send({ tipoMsg: "erro", msg: "Email ou Senha Inválidos" });
                }
            });
            // Se o email não existir, então esse usuário não foi cadastrado no Banco de Dados e o Login não vai poder ser feito
        } else {
            res.send({ tipoMsg: "erro", msg: "Usuário não Existe" })
        }
    });
});

// Criação de Rota para auxiliar em um processo de análise de sessão do Front-End, indicando se a sessão tanto do User ou do Admin possam estar ativas ou não.
app.get("/confirmarSession", (req, res) => {
    if (req.session.admin || req.session.user) {
        res.send({ sessionAtiva: true })
    } else {
        res.send({ sessionAtiva: false })
    }
});

// Middleware que vai servir para analisar o Token que será recebido do Front-End
const verificarJWT = (req, res, next) => {
    const token = req.headers["x-acess-token"];

    // Caso não houver um token ativo ou recebido
    if (!token) {
        req.session.destroy((error) => {
            if (error) {
                console.log(error)
            } else {
                res.clearCookie("userId");
                res.send({ semToken: true, msg: "Não há um Token Ativo, Sessão Encerrada" });
            }
        });
        // Caso houver um token ativo
    } else {
        // Verificar o Token para ver se estruturamente está correto
        jwt.verify(token, 'senhaSecretJWT', (errorToken, decoded) => {
            // Caso o Token apresente algum erro em sua estrutura, será disparado um erro e a sessão que foi ativada em conjunto ao Token, antes de ser analisado, será encerrada
            if (errorToken) {
                req.session.destroy((error) => {
                    if (error) {
                        console.log(error)
                    } else {
                        res.clearCookie("userId");
                        res.send({ msg: "Falha ao Autenticar" });
                    }
                });
            }
            // Caso o Token não apresente nenhum erro, então a análise foi um secesso e ele poderá seguir para a Rota em que está inserido
            else {
                next();
            }
        });
    }
}

// Criação da Rota para consumo de sessão, independente de qual estiver ativa, caso nenhuma das duas estiver ativa uma mensagem será disparada.
// Antes haverá um procedimento de análise do Token, para se ter a base de que ele está corretamente estruturado ou ativo, com isso a função de análise da sessão pode seguir em diante.
app.get("/loginAuth", verificarJWT, (req, res) => {
    if (req.session.admin) {
        res.send({ authAdmin: true, admin: req.session.admin });
    }
    else if (req.session.user) {
        res.send({ authUser: true, user: req.session.user });
    } else {
        res.send({ msg: "Sessão Finalizada" });
    }
});


// Criação da Rota de Logout que vai eliminar a sessão ativa, a encerrando, além de limpar o Cookie salvo no Browser
app.get("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.log(error)
        } else {
            res.clearCookie("userId");
            res.send({ msg: "Sessão Encerrada" });
        }
    });
});

// Função para realizar a adição da imagem recebida a pasta no Google Drive
async function uploadFile(req, res, next) {

    // Se uma imagem for recebida
    if (req.file) {
        // Nome do arquivo a ser enviado e o local que será enviado, dentro do Google Drive
        const fileMetaData = {
            'name': req.file.filename,
            'parents': [GOOGLE_API_FOLDER_ID]
        }

        // Os dados do arquivo, sendo o tipo do arquivo e o seu corpo a ser salvo no Google Drive
        const media = {
            mimeType: req.file.mimetype,
            body: fs.createReadStream(req.file.path)
        }

        // Passando os parâmetros para criação do arquivo no Google Drive, para depois receber a resposta do id daquele arquivo criado
        const responseDrive = await driveService.files.create({
            resource: fileMetaData,
            media: media,
            fields: 'id'
        })

        // Salvando o id do arquivo criado em uma variável, para ser usado dentro de outro Middleware
        req.dataUploadFile = responseDrive.data.id;

        next();
    } else {
        next();
    }
}

// Função para deletar um determinado arquivo, usando o id daquele arquivo para localizar ele e assim o excluir do Google Drive
async function deleteFile(idFile) {
    await driveService.files.delete({
        fileId: idFile
    });
}

// Criação da Rota que vai servir para adicionar os itens ao Banco de Dados, inicialmente os dados da imagem são tratados no middleware antes de serem salvos no servidor, para ver se estão aptos ou não, com base nas diretivas estabelecidas no mesmo
app.post("/adicionarItens", uploadImage.single('image'), uploadFile, (req, res) => {
    // Caso o Middleware devolva uma resposta negativa no tratamento da imagem, uma mensagem será disparada e o restante do código não será executado
    if (!req.file) {
        return res.send({ tipoMsg: "erro", msg: "Erro no Upload" });
    }

    // Recebendo os dados e recuperando apenas o nome que foi tratado da imagem
    const image = req.dataUploadFile;
    const { nomeitem } = req.body;
    const { descricao } = req.body;
    const { valor } = req.body;

    // Inicialmente verificar se o item que está sendo enviado já não existe no Banco de Dados
    let sqlVerificar = "SELECT * FROM itens WHERE nomeitem = ?;";

    db.query(sqlVerificar, [nomeitem], (error, result) => {
        if (error) {
            console.log(error);
        }
        // Se não existir, o código segue para a inserção dos dados no Banco de Dados
        if (result.length === 0) {

            // Com os valores recuperados, tem que haver um tratamento do valor antes de inseri-lo no Banco de Dados, isso por conta de que o formato que está chegando é em String, por conta da máscara que precisou ser feita na parte do Front-End.
            // Para iniciar o tratamento, transformamos a String em Float, sendo esse um valor acessível ao que o Banco de Dados espera receber, após isso as marcações dos sinais tem que ser refeitas por meio do método replace, para que o valor mantenha a mesma identidade do seu original
            const novoValor = parseFloat(valor.replace(/\D/g, "").replace(/(\d)(\d{2})$/, "$1.$2").replace(/(?=(\d{3})+(\D))\B/g, ""));

            // Com o tratamento devidamente feito, agora inserimos os dados no Banco de Dados
            let sqlAdicionar = "INSERT INTO itens (nomeitem, descricao, valor, image) VALUES (?, ?, ?, ?);";

            db.query(sqlAdicionar, [nomeitem, descricao, novoValor, image], (err, response) => {
                if (err) {
                    console.log(err);
                } else {
                    res.send({ tipoMsg: "correto", msg: "Item Adicionado" });
                }
            });
            // Caso existir o item no Banco de Dados, então ele não será gravado            
        } else {
            // Acionando a função para deletar a imagem em específico, passando o id da imagem a ser excluida como parâmetro
            deleteFile(req.dataUploadFile);
            res.send({ tipoMsg: "erro", msg: "Item já Adicionado" });
        }
    });
});

// Criação da Rota para a listagem dos itens que foram salvos no Banco de Dados
app.get("/listarItens", (req, res) => {
    let sqlListar = "SELECT * FROM itens;";

    db.query(sqlListar, (error, result) => {
        if (error) {
            console.log(error);
        } else {
            res.send({ itens: result, url: "https://drive.google.com/uc?export=view&id=" });
        }
    });
});

// Criação da Rota para listar apenas os dados de um item em específico
app.get("/listarItemEditar/:iditens", (req, res) => {

    // Recuperando o userpedido por meio do parâmetro instanciado na rota
    const { iditens } = req.params;

    let sqlSelecionar = "SELECT * FROM itens WHERE iditens = ?;";

    db.query(sqlSelecionar, [iditens], (error, result) => {
        if (error) {
            console.log(error);
        } else {
            res.send({ itens: result });
        }
    });
});

// Criação da Rota para poder editar os dados de um item em específico
app.patch("/editarItens/:iditens", uploadImage.single("image"), uploadFile, (req, res) => {

    // Recuperando o userpedido por meio do parâmetro instanciado na rota
    const { iditens } = req.params;
    const image = req.file ? req.dataUploadFile : '';
    const { nomeitem } = req.body;
    const { descricao } = req.body;
    const { valor } = req.body;

    // Selecionar o item em específico
    let sqlSelecionar = "SELECT * FROM itens WHERE iditens = ?;";

    db.query(sqlSelecionar, [iditens], (error, result) => {
        if (error) {
            console.log(error);
        }
        // A imagem também precisa ser tratada no servidor, para evitar inconsistência de dados.
        // Caso houver uma imagem que está sendo recebida
        else if (image.length > 0) {
            // A imagem que está salva no servidor desse item em específico vai ser excluida, para que essa nova imagem que foi salva tome o seu lugar
            // Acionando a função para deletar a imagem em específico, passando o id da imagem a ser excluida como parâmetro
            deleteFile(result[0].image);
            // Com os valores recuperados, tem que haver um tratamento do valor antes de inseri-lo no Banco de Dados, isso por conta de que o formato que está chegando é em String, por conta da máscara que precisou ser feita na parte do Front-End.
            // Para iniciar o tratamento transformamos a String em Float, sendo esse um valor acessível ao que o Banco de Dados espera receber, após isso as marcações dos sinais tem que ser refeitas por meio do método replace, para que o valor mantenha a mesma identidade do seu original
            const novoValor = parseFloat(valor.replace(/\D/g, "").replace(/(\d)(\d{2})$/, "$1.$2").replace(/(?=(\d{3})+(\D))\B/g, ""));

            // Após o tratamento, a alteração vai ser feita nesse item em específico
            let sqlUpdate = "UPDATE itens SET nomeitem = ?, descricao = ?, valor = ?, image = ? WHERE iditens = ?;";

            db.query(sqlUpdate, [nomeitem, descricao, novoValor, image, iditens], (err, response) => {
                if (err) {
                    console.log(err);
                } else {
                    res.send({ tipoMsg: "correto", msg: "Dados Atualizados com Sucesso" });
                }
            });
            // Caso não houver uma imagem enviada
        } else {
            // Para não enviar uma string vazia, então se mantem o mesmo nome da imagem que já está no Banco de Dados
            const imageBD = result[0].image;

            // Com os valores recuperados, tem que haver um tratamento do valor antes de inseri-lo no Banco de Dados, isso por conta de que o formato que está chegando é em String, por conta da máscara que precisou ser feita na parte do Front-End.
            // Para iniciar o tratamento transformamos a String em Float, sendo esse um valor acessível ao que o Banco de Dados espera receber, após isso as marcações dos sinais tem que ser refeitas por meio do método replace, para que o valor mantenha a mesma identidade do seu original
            const novoValor = parseFloat(valor.replace(/\D/g, "").replace(/(\d)(\d{2})$/, "$1.$2").replace(/(?=(\d{3})+(\D))\B/g, ""));

            // Após o tratamento, a alteração vai ser feita nesse item em especifico
            let sqlUpdate = "UPDATE itens SET nomeitem = ?, descricao = ?, valor = ?, image = ? WHERE iditens = ?;";

            db.query(sqlUpdate, [nomeitem, descricao, novoValor, imageBD, iditens], (errorBase, responseDados) => {
                if (errorBase) {
                    console.log(errorBase);
                } else {
                    res.send({ tipoMsg: "correto", msg: "Dados Atualizados com Sucesso" });
                }
            });
        }
    });
});

// Criação da Rota para excluir itens específicos
app.delete("/deletaritens/:iditens", (req, res) => {
    // Recuperando o id daquele item em específico
    const { iditens } = req.params;

    // Selecionando o item com base no id recuperado
    let sqlSelecionar = "SELECT * FROM itens WHERE iditens = ?;";

    db.query(sqlSelecionar, [iditens], (error, result) => {
        if (error) {
            console.log(error)
        }
        // Antes de excluir o item, verificar se existe algum pedido adicionado com o mesmo nome do item, para que com isso esse ou esses pedidos também fossem excluídos
        else {
            // Verificar toda a tabela de pedidos
            let sqlVerificarPedido = "SELECT * FROM pedidos;";

            db.query(sqlVerificarPedido, (errorPedido, response) => {
                if (errorPedido) {
                    console.log(errorPedido);
                } else {
                    // Utilizar o método some para analisar na tabela pedidos se há nomes ou um nome igual ao nome desse item em específico, se houver ele vai retornar True, caso contrário ele vai retornar False
                    const verificarPedido = response.some((pedido) => pedido.nomepedido === result[0].nomeitem);

                    // Se houver um ou vários pedidos com o mesmo nome do item
                    if (verificarPedido) {
                        // Inicialmente vai ser feita a exclusão da imagem daquele item em específico do servidor
                        // Acionando a função para deletar a imagem em específico, passando o id da imagem a ser excluida como parâmetro
                        deleteFile(result[0].image);

                        // Depois o item vai ser deletado no Banco de Dados
                        let sqlDelete = "DELETE FROM itens WHERE iditens = ?;";

                        db.query(sqlDelete, [iditens], (errorBase, response) => {
                            if (errorBase) {
                                console.log(errorBase);
                            } else {
                                // Utilizar o nome do item como referência para poder deletar o pedido com o mesmo nome, antes da exclusão total do item
                                const nomePedido = result[0].nomeitem;

                                // Passar o nome daquele pedido como forma de excluir ele por completo
                                let sqlDeletePedido = "DELETE FROM pedidos WHERE nomepedido = ?;";

                                db.query(sqlDeletePedido, [nomePedido], (errorPedido, resultPedido) => {
                                    if (errorPedido) {
                                        console.log(errorPedido)
                                    } else {
                                        res.send({ msg: "Item Excluido com Sucesso" });
                                    }
                                });
                            }
                        });

                    }
                    // Se não houver um ou vários pedidos com o mesmo nome do item, ele vai fazer a exclusão apenas daquele determinado item
                    else {
                        // Acionando a função para deletar a imagem em específico, passando o id da imagem a ser excluida como parâmetro
                        deleteFile(result[0].image);

                        let sqlDelete = "DELETE FROM itens WHERE iditens = ?;";

                        db.query(sqlDelete, [iditens], (errorBase, response) => {
                            if (errorBase) {
                                console.log(errorBase)
                            } else {
                                res.send({ msg: "Item Excluido com Sucesso" });
                            }
                        });


                    }
                }
            });
        }
    });
});

// Criação da Rota que vai servir para gravar os dados do Pedido recebido no Banco de Dados
app.post("/confirmarPedido", (req, res) => {
    const { nomepedido } = req.body;
    const { qtdpedido } = req.body;
    const { valorfinal } = req.body;
    const { userpedido } = req.body;

    // Inserir os valores recebidos no Banco de Dados
    let sqlInsert = "INSERT INTO pedidos (nomepedido, qtdpedido, valorfinal, userpedido) VALUES (?, ?, ?, ?);";

    db.query(sqlInsert, [nomepedido, qtdpedido, valorfinal, userpedido], (error, result) => {
        if (error) {
            console.log(error)
        } else {
            res.send({ msg: "Pedido Confirmado" })
        }
    });
});

// Criação da Rota que vai servir para listar os pedidos de um usuário em específico
app.get("/listaPedidos/:userpedido", (req, res) => {
    // Recuperando o userpedido por meio do parâmetro instanciado no rota
    const { userpedido } = req.params;

    // Com base em um userpedido, os pedidos vão ser selecionados e enviados ao Front-End
    let sqlListar = "SELECT * FROM pedidos WHERE userpedido = ?;";

    db.query(sqlListar, [userpedido], (error, result) => {
        if (error) {
            console.log(error)
        } else {
            res.send({ pedido: result })
        }
    });
});

// Criação da Rota que vai servir para deletar um pedido em específico
app.delete("/deletarPedido/:idpedidos", (req, res) => {
    // Recuperando o userpedido por meio do parâmetro instanciado na rota
    const { idpedidos } = req.params;

    // Deletar o pedido com base no idpedidos
    let sqlDelete = "DELETE FROM pedidos WHERE idpedidos = ?;";

    db.query(sqlDelete, [idpedidos], (error, result) => {
        if (error) {
            console.log(error)
        } else {
            res.send({ msg: "Pedido excluido com sucesso" });
        }
    });
});

// Criação da Rota que vai finalizar todos os pedidos, assim servindo para encerrar o carrinho de pedidos
app.delete("/finalizarPedido/:userPedidoBD", (req, res) => {
    // Recuperando o userpedido por meio do parâmetro instanciado na rota
    const { userPedidoBD } = req.params;

    // Com base no userpedido, todos os pedidos que estiverem no Carrinho de Pedidos vão ser excluídos
    let sqlDelete = "DELETE FROM pedidos WHERE userpedido = ?;";

    db.query(sqlDelete, [userPedidoBD], (error, result) => {
        if (error) {
            console.log(error)
        } else {
            res.send({ msg: "Lista de Pedidos Finalizada" });
        }
    });
});

// Configurando e ativando a porta do servidor
app.listen(process.env.PORT || PORT, () => {
    console.log(`Server on na Porta ${PORT}`);
});