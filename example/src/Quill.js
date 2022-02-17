import {useState, useCallback, useEffect} from 'react'

import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Form from 'react-bootstrap/Form'

import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

function QuillSample(props) {

    const [text, setText] = useState('')
    const [textReadOnly, setTextReadOnly] = useState('')

    useEffect(()=>{
        // console.debug("Update text : %O", text)
    }, [text])

    return (
        <Container>
            <h1>Quill</h1>

            <Editeur text={text} setText={setText} />

            <Detail text={text} />

            <LoadText setText={setText} setTextReadOnly={setTextReadOnly} />

            <AffichageReadOnly text={text} />
        </Container>
    )
}

export default QuillSample

function Editeur(props) {

    // const [text, setText] = useState('')
    const {text, setText} = props
    const handleChange = useCallback(value=>setText(value), [setText])

    return (
        <>
            <ReactQuill 
                value={text}
                onChange={handleChange} />
        </>
    )
}

function Detail(props) {

    const { text } = props

    return (
        <div>
            <p>Delta</p>

            <p>{text}</p>
        </div>
    )
}

function AffichageReadOnly(props) {
    const { text } = props
    return <ReactQuill value={text} readOnly={true} theme='' />
}

function LoadText(props) {

    const { setText, setTextReadOnly } = props

    const [textHtml, setTextHtml] = useState('')

    const changeTextHtml = useCallback(event=>setTextHtml(event.currentTarget.value), [setTextHtml])
    const editer = useCallback(()=>setText(textHtml), [textHtml, setText])
    const afficher = useCallback(()=>setText(setTextReadOnly), [textHtml, setTextReadOnly])

    return (
        <div>
            <Form.Group controlId="textHtml">
                <Form.Label>Texte a importer</Form.Label>
                <Form.Control as="textarea" rows={3} onChange={changeTextHtml} value={textHtml} />
            </Form.Group>
            <Button onClick={editer}>Editer</Button>
            <Button onClick={afficher}>Afficher</Button>
        </div>
    )
}
