const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const number = '558599999999';
const message = 'Olá! Aqui vai o arquivo que prometi.';
const filePath = path.resolve(__dirname, 'BOLETO.pdf');

const form = new FormData();
form.append('number', number);
form.append('message', message);
form.append('file', fs.createReadStream(filePath));

axios.post('http://localhost:3000/send-message', form, {
    headers: form.getHeaders()
}).then(response => {
    console.log('✅ Resposta do servidor:', response.data);
}).catch(error => {
    if (error.response) {
        console.error('❌ Erro na resposta:', error.response.data);
    } else {
        console.error('❌ Erro na requisição:', error.message);
    }
});
