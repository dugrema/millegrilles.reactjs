import React, {useEffect, useState, useCallback} from 'react'
import Button from 'react-bootstrap/Button'
import { ouvrirDB, updateUsager } from '@dugrema/millegrilles.reactjs'

export default function DbUsagerExemple(props) {

    const [db, setdb] = useState()

    const creerUsagerCb = useCallback(()=>{
        creerUsager(db).catch(err=>console.error("Erreur creation usager: %O", err))
    }, [db])

    const updateFctCb = useCallback(()=>{
        updateFct(db).catch(err=>console.error("Erreur update fct: %O", err))
    }, [db])

    useEffect(()=>{
        ouvrir().then(db=>setdb(db)).catch(err=>console.error("Erreur ouverture db", err))
    }, [])

    return (
        <div>
            <h1>DB Usager Exemple</h1>

            <p>Creer usager: <Button onClick={creerUsagerCb}>Creer</Button></p>
            <p>Update fct: <Button onClick={updateFctCb}>Update</Button></p>
        </div>
    )
}

async function ouvrir() {
    return ouvrirDB({upgrade: true})
}

async function creerUsager() {
    const nomUsager = 'test1'
    const params = {
        'valeur': 'un test',
        // 'fct': valeur => console.info("Ma valeur : %O", valeur)
    }
    await updateUsager(nomUsager, params)
    console.debug("Update usage complete")
}

async function updateFct() {
    const nomUsager = 'test1'
    const obj1 = {key: 'valeur1'}
    const params = {
        // 'valeur': 'un test',
        // 'fct': valeur => console.info("Ma valeur : %O", valeur)
        obj1
    }
    await updateUsager(nomUsager, params)
    console.debug("Update fct complete")
}