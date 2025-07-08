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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

app.post('/send-message', upload.single('file'), async (req, res) => {
    const { number, message } = req.body;
    const file = req.file;

    if (!number || !message || !file) {
        return res.status(400).json({ error: 'Número, mensagem e arquivo são necessários!' });
    }

    const chatId = number + '@c.us';

    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
        return res.status(400).json({ error: 'Esse número não está registrado no WhatsApp.' });
    }

    const cleanNumber = number.replace(/\D/g, '');

    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        return res.status(400).json({ error: 'Número inválido!' });
    }

    const filePath = path.join('uploads', file.originalname);
    const fileName = path.basename(filePath);
    const media = new MessageMedia(file.mimetype, fs.readFileSync(filePath).toString('base64'), fileName);

    const trySend = async (num) => {
        const chatId = num + '@c.us';

        try {            
            await delay(randomDelay(10000, 30000));
            await client.sendMessage(chatId, message);
            console.log(`✅ Mensagem enviada para ${num}`);
            
            await delay(randomDelay(10000, 30000));
            await client.sendMessage(chatId, media);
            console.log(`✅ Arquivo enviado para ${num}`);

            return true;
        } catch (err) {
            console.error(`Erro ao enviar para ${num}:`, err);
            return false;
        }
    };

    const variations = [cleanNumber];

    if (cleanNumber.length === 12) {
        const prefix = cleanNumber.slice(0, 4);
        const rest = cleanNumber.slice(4);
        const com9 = prefix + '9' + rest;
        if (!variations.includes(com9)) variations.push(com9);
    }

    if (cleanNumber.length === 13) {
        const prefix = cleanNumber.slice(0, 4);
        const rest = cleanNumber.slice(4);
        if (rest.charAt(0) === '9') {
            const sem9 = prefix + rest.slice(1);
            if (!variations.includes(sem9)) variations.push(sem9);
        }
    }

    let textoConfirmado = false;
    let arquivoConfirmado = false;

    for (let tentativa = 1; tentativa <= 5; tentativa++) {
        console.log(`🔁 Tentativa ${tentativa} de verificação...`);
        try {
            const chat = await client.getChatById(chatId);
            const mensagensRecentes = await chat.fetchMessages({ limit: 2 });

            textoConfirmado = mensagensRecentes.some(msg =>
                msg.fromMe && msg.body === message
            );

            arquivoConfirmado = mensagensRecentes.some(msg =>
                msg.fromMe &&
                msg.hasMedia &&
                msg.type === 'document'
            );

            if (textoConfirmado && arquivoConfirmado) {
                console.log('✅ Mensagem e arquivo confirmados!');
                break;
            } else {
                console.log('⏳ Ainda não confirmado. Tentando novamente...');
            }
        } catch (err) {
            console.warn('⚠️ Erro ao buscar mensagens:', err.message);
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (textoConfirmado && arquivoConfirmado) {
        return res.status(200).json({
            success: true,
            message: 'Mensagem e arquivo enviados e confirmados com sucesso.'
        });
    } else {
        return res.status(500).json({
            success: false,
            error: 'Falha ao confirmar o envio da mensagem ou do arquivo.',
            detalhes: {
                textoConfirmado,
                arquivoConfirmado
            }
        });
    }
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
