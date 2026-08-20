# PrintFlow MVP real

## Servidor

```powershell
npm install
npm start
```

Abrir `http://localhost:3000`. Los trabajos y PDFs se guardan en `data/`.

## Print Agent en Windows

En la PC conectada a la Epson:

```powershell
$env:PRINTFLOW_URL="https://tu-servidor.example.com"
$env:PRINTER_NAME="Epson L4150"
npm run agent
```

El agente descarga el PDF sin modificarlo y usa el comando de impresión de Windows. El nombre exacto de la impresora debe coincidir con el instalado en Windows. Para producción hay que agregar autenticación de usuarios, token del agente, HTTPS y un instalador/servicio de Windows.
