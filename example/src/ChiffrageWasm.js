import('@dugrema/wasm-crypto/wasm_crypto.js').then(js=>{
    console.debug("Importe WASM : %O", js)
    js.greet()
}).catch(err=>{
    console.error("Erreur chargement wasm : %O", err)
})

// https://koala42.com/using-webassembly-in-your-reactjs-app/

function ChiffrageWasm(props) {
    return (
        <div>
            <h1>Chiffrage Wasm</h1>
        </div>
    )
}

export default ChiffrageWasm