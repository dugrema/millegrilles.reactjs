import React, {useState, useEffect, useCallback} from 'react'
import { Container, Row, Col, Button } from 'react-bootstrap'
import { FilePicker } from 'millegrilles.reactjs'

export default props => {

    const [data, setData] = useState('')
    useEffect(()=>{ setData(preparerSamples1()) }, [])

    return (
        <div>
            <h1>File picker example</h1>
            <div style={{position: 'absolute', left: '1rem', width: '30rem', height: '40rem', border: '1px solid black'}}>
                <FilePicker data={data} />
            </div>
        </div>
    )
}

function preparerSamples1() {
    return {
        cuuid: 'abcd-1234',
        nom: 'Racine',
        contenu: [
            {cuuid: 'abcd-1235', nom: 'Sous rep1'},
            {cuuid: 'abcd-1236', nom: 'Sous rep2'},
            {fuuid: 'abcd-1237', nom: 'Fichier 1'},
        ]
    }
}