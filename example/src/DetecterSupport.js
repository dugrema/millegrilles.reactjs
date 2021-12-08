import {useEffect, useState} from 'react'
import {detecterAppareilsDisponibles, supporteFormatWebp, supporteFormatWebm, supporteFileStream, isTouchEnabled} from '@dugrema/millegrilles.reactjs'

function DetecterSupport(props) {

    const [ support, setSupport ] = useState({})

    useEffect(()=>detecter(setSupport), [setSupport])

    return (
        <div>
            <h1>Support detecte</h1>
            <p>Appareils : {''+support.appareils}</p>
            <p>webp : {''+support.webp}</p>
            <p>webm : {''+support.webm}</p>
            <p>stream : {''+support.stream}</p>
            <p>touch : {''+support.touch}</p>
        </div>
    )
}

export default DetecterSupport

async function detecter(setSupport) {
    const appareils = await detecterAppareilsDisponibles()
    const webp = await supporteFormatWebp()
    const webm = supporteFormatWebm()
    const stream = supporteFileStream()
    const touch = isTouchEnabled()

    const support = {appareils, webp, webm, stream, touch}

    console.debug("Support : %O", support)

    setSupport(support)
}