import { createBreakpoints } from "@chakra-ui/theme-tools";

const theme = {
  breakpoints: createBreakpoints({
    xs: "30em",
    sm: "36em",
    md: "46.25em",
    lg: "62.5em",
    xl: "78.125em",
    xxl: "95em"
  }),
  components: {
    Heading: {
      baseStyle: {
        fontFamily: "inherit",
        fontWeight: "normal",
        color: "inherit"
      }
    },
    Text: {
      baseStyle: {
        fontFamily: "inherit",
        fontWeight: "normal",
        lineHeight: "tall",
        color: "inherit"
      }
    },
    Button: {
      baseStyle: {
        textTransform: "uppercase",
        letterSpacing: "wide",
        fontWeight: "normal",
        userSelect: "none"
      }
    }
  }
};

export default theme;