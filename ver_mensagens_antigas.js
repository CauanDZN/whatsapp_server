const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const xlsx = require('xlsx');

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ Cliente está pronto!');

    const number = '5585987673952';
    const chatId = number + '@c.us';

    try {
        const chats = await client.getChats();
        const chat = chats.find(c => c.id._serialized === chatId);

        if (!chat) {
            console.log('❌ Chat não encontrado. Talvez nunca tenha conversado com esse número.');
            return;
        }

        console.log(`📩 Buscando mensagens do número: ${number}`);

        const messages = await chat.fetchMessages({ limit: 10 });

        if (messages.length === 0) {
            console.log('⚠️ Nenhuma mensagem encontrada.');
        } else {
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
                    Número: number,
                    Mensagem: mensagemFormatada,
                    Data: new Date(msg.timestamp * 1000).toLocaleString(),
                    Status: msg.fromMe ? 'Enviado' : 'Recebido',
                    Estado: msg.fromMe 
                        ? (msg.ack === 0 ? '⏳ Pendente' : 
                           msg.ack === 1 ? '✔ Enviado' : 
                           msg.ack === 2 ? '✔✔ Entregue' : 
                           msg.ack === 3 ? '✅✅ Lida' : 'Desconhecido') 
                        : 'Recebido'
                });
            }

            saveToExcel(data, 'mensagens.xlsx');
            console.log('✅ Mensagens salvas na planilha "mensagens.xlsx".');
        }

    } catch (error) {
        console.error('🚨 Erro ao buscar mensagens:', error);
    }
});

client.initialize();

function saveToExcel(data, fileName) {
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Mensagens');

    xlsx.writeFile(wb, fileName);
}
