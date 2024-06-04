import React, { useEffect, useState, Component } from 'react';
import "../admin/admin.css";
import Header from "../common/chakra_header.js";
import Footer from "../common/footer.js";

import { VStack, HStack, Flex, Box, Heading, Spacer, Text } from "@chakra-ui/layout";
import Markdown from 'react-markdown';
import {
    Image,
    Button,
    Divider,
    Table,
    Thead,
    Tbody,
    Tfoot,
    Tr,
    Th,
    Td,
    TableCaption,
    TableContainer,
    FormControl,
    Input,
    Textarea,
    Checkbox,
    CheckboxGroup
} from '@chakra-ui/react'
import { useForm } from "react-hook-form";
import { UserAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from "axios";
import deployment from "../../deployment.json";

const CreateBlog = props => {
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

    const nav = useNavigate();

    const onSubmit = (data) => createPost();
    const { control, handleSubmit } = useForm();

    const createPost = async e => {
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
            await axios.post(deployment.production + "/blogposts/add", post)
            nav("/_cpanel");
        } catch (e) {
            console.log(e.message);
        }
    }

    return (
        <VStack p={5}>
            <Header />
            <Box align="center" pb={10}>
                <Text pb={3} fontSize="3xl">Create Blog</Text>
            </Box>
            <Divider />
            <Box width="80%" pt={3}>
                <form>
                    <VStack>
                        <Input required variant="flushed" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
                        <Input variant="flushed" placeholder="Subtitle" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
                        {/* Preview */}
                        <Box>
                            <Image src={banner} />
                        </Box>
                        <Input variant="flushed" placeholder="Banner url" value={banner} onChange={e => setBanner(e.target.value)} />

                        {/* <Textarea placeholder="Description" value={description} onChange={e => setDesc(e.target.value)} /> */}
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
                        {/* <Button as={Link} to="/" variant="primary">Back</Button> */}
                        <HStack>
                            <Button onClick={e => { e.preventDefault(); nav(-1) }}>Back</Button>
                            <Button type="submit" onClick={createPost}>Create</Button>
                        </HStack>
                        <br />
                    </VStack>
                </form>
            </Box>
            <Footer />
        </VStack>
    );
}

export default CreateBlog;