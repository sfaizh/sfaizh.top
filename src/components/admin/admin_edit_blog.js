import React, { useEffect, useState, Component } from 'react';
import "../admin/admin.css";
import Header from "../common/chakra_header.js";
import Footer from "../common/footer.js";

import { VStack, HStack, Flex, Box, Heading, Spacer, Text } from "@chakra-ui/layout";
import Markdown from 'react-markdown'
// import markdownit from 'markdown-it';
// import lazy_loading from 'markdown-it-image-lazy-loading';
import {
    Image,
    Button,
    Divider,
    FormControl,
    Input,
    Textarea,
    Checkbox,
    CheckboxGroup
} from '@chakra-ui/react'
import { Select } from "chakra-react-select";
import { useForm } from "react-hook-form";
import { UserAuth } from '../../context/AuthContext';
import { useNavigate, Link, useParams } from 'react-router-dom';
import axios from "axios";
import deployment from "../../deployment.json";

const EditBlog = props => {
    // const [post, setPost] = useState( null );
    const [title, setTitle] = useState("");
    const [subtitle, setSubtitle] = useState("");
    const [description, setDesc] = useState("");
    const [author, setAuthor] = useState("");
    const [date, setDate] = useState("");
    const [tags, setTags] = useState("");
    const [footer, setFooter] = useState("");
    const [banner, setBanner] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const md = markdownit();
    md.use(lazy_loading);

    const nav = useNavigate();

    const onSubmit = (data) => updatePost();
    // const { control, handleSubmit } = useForm();
    const { id } = useParams();

    useEffect(() => {
        const fetch = async () => {
            try {
                const r = await axios.get(deployment.production + "/blogposts/" + id).then(r => {
                    setTitle(r.data.title)
                    setSubtitle(r.data.subtitle)
                    setDesc(r.data.description)
                    setAuthor(r.data.author)
                    setDate(r.data.date)
                    setTags(r.data.tags)
                    setFooter(r.data.footer)
                    setBanner(r.data.images.main)
                    setIsPrivate(r.data.isPrivate)
                })
            } catch (e) {
                console.log(e.message);
            }
        }
        fetch();

        return () => {

        }
    }, []);

    // if (!post) return null;
    // const lazyLoadModule = async e => {
    //     e.preventDefault();
    //     md.render(description);
    // }

    const removePost = async e => {
        e.preventDefault();

        try {
            await axios.delete(deployment.production + "/blogposts/" + id)
            nav(-1)
        } catch (e) {
            console.log(e.message);
        }
    }

    const updatePost = async e => {
        e.preventDefault();

        const post = {
            title,
            subtitle,
            description,
            author,
            date,
            tags,
            footer,
            "images": {
                "main": banner
            },
            isPrivate
        }

        try {
            await axios.post(deployment.production + "/blogposts/update/" + id, post)
            nav(-1)
        } catch (e) {
            console.log(e.message);
        }
    }

    const viewPost = async e => {
        e.preventDefault();

        nav("/view/" + id)
    }


    return (
        <VStack p={5}>
            <Header />
            <Box align="center" pb={10}>
                <Text pb={3} fontSize="3xl">Edit Blog</Text>
            </Box>
            <Divider />
            <Box width="80%" pt={3}>
                <FormControl>
                    <VStack>
                        <Input required variant="flushed" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
                        <Input variant="flushed" placeholder="Subtitle" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
                        <br />
                        <Text>Banner Url</Text>
                        <Input variant="flushed" placeholder="Banner url" value={banner} onChange={e => setBanner(e.target.value)} />
                        <Box align="center">
                            <Image width="60%" src={banner} />
                        </Box>
                        <HStack pb={8} pt={8}>
                            <Box width='50%' p='5'>
                                <Text fontSize='2xl'>Markdown</Text>
                                <Textarea style={{'min-height':'600px'}} placeholder="Description" value={description} onChange={e => setDesc(e.target.value)} />
                            </Box>
                            <Box width="50%">
                                <Text fontSize='2xl'>Preview</Text>
                                <Box style={{'max-height':'600px', 'overflow-y':'auto'}}>
                                    <Markdown>{description}</Markdown>
                                </Box>
                                
                            </Box>
                        </HStack>
                        <HStack width="100%">
                            <Input required variant="flushed" placeholder="Author" value={author} onChange={e => setAuthor(e.target.value)} />
                            <Input required size="md" type="datetime-local" placeholder="Date & Time" value={date} onChange={e => setDate(e.target.value)} />
                        </HStack>
                        <Input variant="flushed" placeholder="Footer" value={footer} onChange={e => setFooter(e.target.value)} />
                        <Input variant="flushed" placeholder="Tags" value={tags} onChange={e => setTags(e.target.value)} />
                        <Checkbox isChecked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)}>Private</Checkbox>
                        <br />
                        <HStack>
                            <Button onClick={e => { e.preventDefault(); nav(-1) }}>Back</Button>
                            <Button onClick={removePost}>Remove Entry</Button>
                            <Button onClick={viewPost}>View Entry</Button>
                            <Button type="submit" onClick={updatePost}>Update</Button>
                        </HStack>
                        <br />
                    </VStack>
                </FormControl>
            </Box>
            <Footer />
        </VStack>
    );
}

export default EditBlog;