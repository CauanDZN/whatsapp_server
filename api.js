const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente do WhatsApp está pronto!');
});

const app = express();

app.use(express.json());

app.post('/send-message', upload.single('file'), (req, res) => {
    const { number, message } = req.body;
    const file = req.file;

    if (!number || !message || !file) {
        return res.status(400).json({ error: 'Número, mensagem e arquivo são necessários!' });
    }

    const filePath = path.join('uploads', file.originalname);
    const fileName = path.basename(filePath);
    const media = new MessageMedia(file.mimetype, fs.readFileSync(filePath).toString('base64'), fileName);

    client.sendMessage(number + '@c.us', message).then(() => {
        console.log('Mensagem de texto enviada com sucesso!');
    }).catch(err => {
        console.error('Erro ao enviar mensagem de texto:', err);
        return res.status(500).json({ error: 'Erro ao enviar mensagem de texto.' });
    });

    setTimeout(() => {
        client.sendMessage(number + '@c.us', media).then(() => {
            console.log('Arquivo enviado com sucesso!');
            res.status(200).json({ success: 'Mensagem e arquivo enviados com sucesso!' });
        }).catch(err => {
            console.error('Erro ao enviar PDF:', err);
            res.status(500).json({ error: 'Erro ao enviar o arquivo PDF.' });
        });
    }, 8000);
});

app.post('/get-messages', async (req, res) => {
    const { number } = req.body;

    if (!number) {
        return res.status(400).json({ error: 'O número é necessário!' });
    }

    const chatId = number + '@c.us';
    
    try {
        const chats = await client.getChats();
        const chat = chats.find(c => c.id._serialized === chatId);

        if (!chat) {
            return res.status(404).json({ error: 'Chat não encontrado.' });
        }

        console.log(`📩 Buscando mensagens do número: ${number}`);
        const messages = await chat.fetchMessages({ limit: 10 });

        if (messages.length === 0) {
            return res.status(404).json({ error: 'Nenhuma mensagem encontrada.' });
        }

        const data = [];
        for (const msg of messages.reverse()) {
            let mensagemFormatada = 'Outro tipo de mensagem';

            if (msg.hasMedia) {
                const media = await msg.downloadMedia();

                switch (msg.type) {
                    case 'image':
                        mensagemFormatada = '📷 Imagem recebida';
                        break;
                    case 'video':
                        mensagemFormatada = '🎥 Vídeo recebido';
                        break;
                    case 'audio':
                        if (media.mimetype === 'audio/ogg; codecs=opus') {
                            mensagemFormatada = '🎤 Áudio de voz recebido';
                        } else {
                            mensagemFormatada = '🎵 Arquivo de áudio recebido';
                        }
                        break;
                    case 'document':
                        const fileName = media?.filename || 'Nome desconhecido';
                        mensagemFormatada = `📄 Documento recebido: ${fileName}`;
                        break;
                    case 'sticker':
                        mensagemFormatada = '🔹 Figurinha recebida';
                        break;
                    default:
                        mensagemFormatada = '📦 Arquivo recebido';
                }
            } else if (msg.body) {
                mensagemFormatada = `📝 Texto: ${msg.body}`;
            }

            data.push({
                number: number,
                message: mensagemFormatada,
                date: new Date(msg.timestamp * 1000).toLocaleString(),
                status: msg.fromMe ? 'Enviado' : 'Recebido',
                state: msg.fromMe 
                    ? (msg.ack === 0 ? '⏳ Pendente' : 
                       msg.ack === 1 ? '✔ Enviado' : 
                       msg.ack === 2 ? '✔✔ Entregue' : 
                       msg.ack === 3 ? '✅✅ Lida' : 'Desconhecido') 
                    : 'Recebido'
            });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('🚨 Erro ao buscar mensagens:', error);
        res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});

client.initialize();
