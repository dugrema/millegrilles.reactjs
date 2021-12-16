import React, {useState, useEffect, useCallback} from 'react'

import Container from 'react-bootstrap/Container'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Button from 'react-bootstrap/Button'

import styles from './styles.module.css'

export default props => {

    const { loadCollection, setPath: setPathOut, nomRoot } = props

    const nomRootLocal = nomRoot || 'Favoris'

    const [ cuuidCourant, setCuuidCourant ] = useState('')
    const [ path, setPath ] = useState([])
    const [ liste, setListe ] = useState([])

    const activeIdx = path.length - 1

    const ouvrirCuuid = useCallback( event => {
        event.stopPropagation()
        event.preventDefault()
        
        const cuuid = event.currentTarget.value
        const collection = liste.filter(item=>item.tuuid === cuuid).pop()
        if(collection) {
            const nouveauPath = [...path, collection]
            // console.debug("Path update : %O", nouveauPath)
            setPath(nouveauPath)
        }
    }, [liste, path, setPath])

    const backPath = useCallback( path => { 
        // console.debug("Back %O", path)
        setPath(path) 
    }, [setPath])

    useEffect(()=>{
        const collectionCourante = path[path.length-1]
        const tuuidCourant = collectionCourante?collectionCourante.tuuid:''
        setCuuidCourant(tuuidCourant)
        setPathOut(path.map(item=>item.tuuid))
    }, [path, setCuuidCourant, setPathOut])

    useEffect(()=>{
        if(!loadCollection || !setListe) return
        loadCollection(cuuidCourant)
        .then(liste=>{
            // console.debug("Cuuid %s, liste collections : %O", cuuidCourant, liste)
            setListe(liste)
        })
        .catch(err=>{
            console.error("Erreur load collection %s : %O", cuuidCourant, err)
        })
    }, [loadCollection, cuuidCourant, setListe])

    let pathCumulatif = []

    return (
        <Container className={styles.filepicker}>
            <Breadcrumb>
                <Breadcrumb.Item onClick={()=>backPath([])}>{nomRootLocal}</Breadcrumb.Item>
                {path.map((item, idx)=>{
                    const active = idx === activeIdx
                    pathCumulatif.push(item)
                    const pathCourant = [...pathCumulatif]
                    return (
                        <Breadcrumb.Item 
                            key={idx} 
                            active={active}
                            onClick={()=>backPath(pathCourant)}
                        >
                            {item.nom}
                        </Breadcrumb.Item>
                    )
                })}
            </Breadcrumb>

            <AfficherListeCollections 
                liste={liste}
                ouvrirCuuid={ouvrirCuuid}
            />

        </Container>
    )
}

function AfficherListeCollections(props) {

    // console.debug("AfficherListeCollections Proppys %O", props)

    const liste = props.liste || []
    const ouvrirCuuid = props.ouvrirCuuid

    return (
        <div className={styles.liste}>
            {liste.map( item => (
                <Row key={item.tuuid}>
                    <Col>
                        <Button variant="link" onClick={ouvrirCuuid} value={item.tuuid}>
                            {item.nom}
                        </Button>
                    </Col>
                </Row>
            ))}
        </div>
    )
}
