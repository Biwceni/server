// Importando biblioteca para o recebimento e tratamento de imagens
const multer = require('multer');

// Exportando a função para poder utilizar no componente principal
module.exports = (multer({
    // Armazenando a imagem e a nomeando
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, './public/upload/images');
        },
        filename: (req, file, cb) => {
            cb(null, Date.now().toString() + '_' + file.originalname);
        }
    }),
    // Filtrando a imagem recebida, caso não atender a extensão correta não será armazenada
    fileFilter: (req, file, cb) => {
        const extensaoImage = ['image/png', 'image/jpg', 'image/jpeg'].find(
            formatoAceito => formatoAceito == file.mimetype);

        if(extensaoImage){
            return cb(null, true);
        }

        return cb(null, false);
    }
}));

// module.exports = (multer({
//     // Armazenando a imagem e a nomeando
//     storage: multer.memoryStorage(),
//     limits: {
//         fileSize: 5 * 1024 * 1024,
//     },
//     // Filtrando a imagem recebida, caso não atender a extensão correta não será armazenada
//     fileFilter: (req, file, cb) => {
//         const extensaoImage = ['image/png', 'image/jpg', 'image/jpeg'].find(
//             formatoAceito => formatoAceito == file.mimetype);

//         if(extensaoImage){
//             return cb(null, true);
//         }

//         return cb(null, false);
//     }
// }));