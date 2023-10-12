import "../home/home.css";

import { useMediaQuery, Icon, SimpleGrid, Link } from "@chakra-ui/react";
import { Stack, Flex, Heading, Spacer, Box, Text } from "@chakra-ui/layout";
import { DiWebplatform } from "react-icons/di";
import { MdSportsMotorsports, MdCardTravel } from 'react-icons/md';
import { GiWeightLiftingUp } from "react-icons/gi";
import { FaIndustry, FaBlog } from "react-icons/fa";


const Categories = () => {

    return (
        <Box alignSelf="center" px="16" py="8">
            <Box align="center" pb="50px">
                <Text fontSize="5xl" fontWeight="semibold">Collection</Text>
                {/* <Text>Sometimes I do some cool stuff</Text> */}
                {/* <Button mt={8} colorScheme="blue" onClick={()=> window.open("https://google.com.au")
                }>Click to enumerate</Button> */}
            </Box>

            {/* <Text fontSize="2xl">Test</Text> */}
            <SimpleGrid columns={{ base: 1, sm: 1, md: 2, lg: 4, xl: 5}} spacing="10px"  align="center">
                <Box rounded="xl" height="200px" pt="5" bg="gray.400">
                    <Icon color="white" pt="0" as={MdSportsMotorsports} w="24" h="24" />
                    <Text color="white" p="4" fontSize="xl" fontWeight="semibold">Motorsports</Text>
                </Box>
                <Box rounded="xl" height="200px" pt="5" bg="gray.400">
                    <Icon color="white" p="4" as={GiWeightLiftingUp} w="24" h="24" />
                    <Text color="white" p="4" fontSize="xl" fontWeight="semibold">Weightlifting</Text>
                </Box>
                <Box rounded="xl" height="200px" pt="5" bg="gray.400">
                    <Icon color="white" p="4" as={MdCardTravel} w="24" h="24" />
                    <Text color="white" p="4" fontSize="xl" fontWeight="semibold">Travelling</Text>
                </Box>

                <Link href="/portfolio/industry">
                    <Box rounded="xl" height="200px" pt="5" bg="#344146" _hover={{ bg: "#778997", }}>
                        <Icon color="white" p="4" as={FaIndustry} w="24" h="24" />
                        <Text color="white" p="4" fontSize="xl" fontWeight="semibold">Industry Experience</Text>
                    </Box>
                </Link>
                <Link href="/portfolio/blog">
                    <Box rounded="xl" height="200px" pt="5" bg="#344146" _hover={{ bg: "#778997", }}>
                        <Icon color="white" p="4" as={FaBlog} w="24" h="24" />
                        <Text color="white" p="4" fontSize="xl" fontWeight="semibold">Blog</Text>
                    </Box>
                </Link>

            </SimpleGrid>
        </Box>            
    )
}

export default Categories;