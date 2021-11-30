import React, {useState, useEffect} from 'react'
import {wrap as comlinkWrap} from 'comlink'
import ChiffrageWorker from './chiffrage.worker'

export default function ChiffrageExemple(props) {

    useEffect(()=>{
        console.debug("Preparation worker : %O", ChiffrageWorker)
        const instance = ChiffrageWorker()
        const worker = comlinkWrap(instance)
        console.debug("Worker : %O", worker)
        worker.initialiserFormatteurMessage().then(()=>{
            console.debug("Ok!")
        }).catch(err=>{console.error("Erreur random : %O", err)})
    }, [])

    return (
        <h1>Chiffrage Worker exemple</h1>
    )
}
