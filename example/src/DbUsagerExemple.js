import React, {useEffect} from 'react'
import { ouvrirDB } from '@dugrema/millegrilles.reactjs'

export default function DbUsagerExemple(props) {

    useEffect(()=>{
        ouvrirDB({upgrade: true})
            .then(db=>{
                console.debug("DB ouverte : %O", db)
            }).catch(err=>{
                console.error("Erreur ouverture DB : %O", err)
            })
    }, [])

    return (
        <div>
            <h1>DB Usager Exemple</h1>
        </div>
    )
}
