const express = require('express')
const app = express()
const client = require('smartsheet')
const accessToken = process.env.TOKEN
//View engine
app.set('view engine', 'ejs')

//Static
app.use(express.static('public'))

const assetSheetId = "3804700140169092"

function columnMap(sheet){
    const columnMap = sheet.columns.reduce((tempMap, col) => { 
        tempMap[col.title] = col.id; 
        return tempMap; 
    }, {})

    return columnMap
}
//App
app.get('/item/:id', async (req, res) => {
    console.log(req.params);
    if (req.params.id == "favicon.ico"){
        return true
    }
    app.locals.id = req.params.id

    const ss = client.createClient({
        accessToken: accessToken
    });

    const id = req.params.id
    const sheet = await ss.sheets.getSheet({id: assetSheetId})
    const sheetColumns = columnMap(sheet)
    const row = sheet.rows.find((row) => {return row.cells[0].value == id})

    let params = row.cells.filter((cell) => {return cell.columnId != sheetColumns["QR Code"]})
    .map((cell) => {
        return (
            Object.keys(sheetColumns).find((name) => sheetColumns[name] == cell.columnId) +
            ": " + cell.value   
        )
    })

    console.log(params);
    res.render('index', {params: params, id: id})
});

app.get('/get/:id', async(req, res)=>{
    res.redirect(authorizationUri)
})

function authorizeURL(params) {
    const authURL = 'https://app.smartsheet.com/b/authorize';
    return `${authURL}?${new URLSearchParams(params)}`;
}

const authorizationUri = authorizeURL({
    response_type: 'code',
    client_id: process.env.APP_CLIENT_ID,
    scope: process.env.ACCESS_SCOPE
});

app.get('/callback', async (req, res) => {
    console.log(req.params);
    const authCode = req.query.code;
    const generated_hash = require('crypto')
        .createHash('sha256')
        .update(process.env.APP_SECRET + "|" + authCode)
        .digest('hex');
    const options = {
        queryParameters: {
            client_id: process.env.APP_CLIENT_ID,
            code: authCode,
            hash: generated_hash
        }
    };
    const ss = client.createClient({accessToken: ''});
    await ss.tokens.getAccessToken(options, setOwner)
        .then((token) => {
            app.locals.token = token
            console.log(app.locals.id);
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
            res.setHeader("Expires", "0"); // Proxies.
            res.redirect(`/item/${app.locals.id}`)
        });
});

async function setOwner(error, token){
    try{
        var ss = client.createClient({accessToken: token.access_token})
        let user = await ss.users.getCurrentUser()

        var ss = client.createClient({accessToken: accessToken})
        let sheet = await ss.sheets.getSheet({id: assetSheetId})

        const row = sheet.rows.find((row) => {return row.cells[0].value == app.locals.id})
        console.log(row);

        let options = {
            sheetId: assetSheetId,
            body: {
                id: row.id,
                cells: [{
                    columnId: columnMap(sheet)["Responsável"],
                    value: user.email
                }]
            }
        }
        let update = await ss.sheets.updateRow(options)
        return update
    }
    catch(err){
        console.log(err);
    }
}
app.listen(8080, () => {
    console.log("Servidor rodando");
})