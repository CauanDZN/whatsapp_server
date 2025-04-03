const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente está pronto!');

    const number = '5585987673952';
    const message = 'Aqui está o PDF que você solicitou!';
    const pdfPath = './pdf.pdf';

    const fileName = path.basename(pdfPath);
    const media = new MessageMedia('application/pdf', fs.readFileSync(pdfPath).toString('base64'), fileName);

    client.sendMessage(number + '@c.us', message).then(() => {
        console.log('Mensagem de texto enviada com sucesso!');
    }).catch(err => {
        console.error('Erro ao enviar mensagem de texto:', err);
    });

    setTimeout(() => {
        client.sendMessage(number + '@c.us', media).then(() => {
            console.log('PDF enviado com sucesso!');
        }).catch(err => {
            console.error('Erro ao enviar PDF:', err);
        });
    }, 8000);
});

client.initialize();
