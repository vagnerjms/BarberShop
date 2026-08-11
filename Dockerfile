FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /usr/src/app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --only=production

# Copiar o restante do código da aplicação
COPY . .

# Expor a porta que a aplicação roda
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["npm", "start"]
