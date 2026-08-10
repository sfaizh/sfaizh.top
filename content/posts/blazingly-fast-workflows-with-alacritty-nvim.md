---
title: Blazingly fast workflows with Alacritty + nvim
date: 2024-07-04
summary: Setting up a terminal-based IDE
tags: [neovim, nvchad, vim, ide]
cover: https://i.imgur.com/50fXw2n.png
draft: false
---

## Motivation

I've always been a fan of terminal-based editors so I thought it would be nice to finally set up something. Ideally this should help me reduce time to debug errors in my code, but also navigate complex logs and configs; something I do every day for work.

**[Github repo for all configuration files](https://github.com/sfaizh/alacritty-nvim-config/tree/main)**

&nbsp;

### Alacritty

The terminal I decided to go with was Alacritty. Josean has documented this really well in his post: **[How To Make Your macOS Terminal Amazing With Alacritty](https://www.josean.com/posts/how-to-setup-alacritty-terminal)**.

For themeing I'm using `gruvbox-light` which you can set in nvchad themes and alacritty so they match. See **[Alacritty theme](https://github.com/alacritty/alacritty-theme)** for more information.

Once you've installed the new terminal and decided on themeing we can move on to the next step: Neovim.

&nbsp;

## Setting up Neovim

Depending on your OS you have a few options. You can either **[install from scratch](https://github.com/neovim/neovim/blob/master/INSTALL.md)**, or a bundler like NvChad. I used **[NvChad](https://nvchad.com/docs/quickstart/install)** to save time, and it had everything I needed.

&nbsp;

### Installation

Installing is simple, just clone the starter config into your nvim directory.

``git clone https://github.com/NvChad/starter ~/.config/nvim && nvim``

Once you're in simply run ``:MasonInstallAll ``

&nbsp;

#### Syntax highlighting

For syntax highlighting we can use treesitter which comes bundled. For example for **go** ``:TSInstall go``. To check which syntaxes have been installed using ``TSInstallInfo``.

&nbsp;

#### Automatic formatting

For the autoformatter you need to ensure you have installed your specified language server and added it to $PATH. Then ensure you're loading the plugin for that specific server.

As an example, the following can be used for a typescript LSP:

``npm install -g typescript typescript-language-server``

Make sure to update your bash profile:

``export PATH="$PATH:$(npm bin -g)"``

We can then add elentok's **[Format on Save](https://github.com/elentok/format-on-save.nvim)** to our lazy.nvim config in `~/.config/nvim/lua/plugins/init.lua`.

```

  {
    "elentok/format-on-save.nvim",
    init = function()
      local formatters = require("format-on-save.formatters")
      require("format-on-save").setup({
        formatter_by_ft = {
          css = formatters.lsp,
          html = formatters.lsp,
          java = formatters.lsp,
          javascript = formatters.lsp,
          json = formatters.lsp,
          lua = formatters.lsp,
          markdown = formatters.prettierd,
          openscad = formatters.lsp,
          python = formatters.black,
          rust = formatters.lsp,
          scad = formatters.lsp,
          scss = formatters.lsp,
          sh = formatters.shfmt,
          terraform = formatters.lsp,
          typescript = formatters.prettierd,
          typescriptreact = formatters.prettierd,
          yaml = formatters.lsp,
        }
      })
      vim.api.nvim_create_autocmd("BufWritePost", {
        pattern = { "*.js", "*.jsx", "*.ts", "*.tsx" },
        callback = function()
          require("format-on-save").format()
        end
      })
    end
  },

  {
    'neovim/nvim-lspconfig',
    config = function()
      local lspconfig = require('lspconfig')

      -- Example: Set up tsserver for JavaScript/TypeScript
      lspconfig.tsserver.setup({
        on_attach = function(client)
          client.server_capabilities.document_formatting = true
        end,
      })

      -- You can add more LSP server setups here if needed
    end,
  },
```

&nbsp;

For other languages, match any additional patterns as needed and remember to install the correct LSP server and add it to your path similar to how we did before. Same for updating``formatter_by_ft`` to include the language you need supported.

For now I've set it up for typescript/javascript projects.

#### Terminal using toggleterm

For quick access to a terminal directly from nvim this is a must. Download **[toggleterm](https://github.com/akinsho/toggleterm.nvim)** and add the following to your **[lazy.nvim](https://github.com/folke/lazy.nvim)** config in ```~/.config/nvim/lua/plugins/init.lua```

```
{
    'akinsho/toggleterm.nvim',
    init = function()
    require("toggleterm").setup({
        size = 20,
        open_mapping = [[<c-\>]],
        direction = "horizontal",
        hide_numbers = true,
        shade_terminals = true,
        shading_factor = 2,
        start_in_insert = true,
        insert_mappings = true,
        persist_size = true,
        close_on_exit = true,
        shell = vim.o.shell,
        float_opts = {
            border = "curved",
            winblend = 0,
            highlights = {
                border = "Normal",
                background = "Normal",
            },
        },
    })
    end,
    version = "*",
    config = true
},
```

For reference I added both those configuration blocks near the end of my `init.lua`, just before ``load_config()``. You can customise the settings to your preference by following the relevant documentation.

I'm still learning and ideally I’d like to use this for more than coding. Debugging and log analysis would be my next use-case. Session management is also important for me so I can configure specific workspaces.

This is a decent base though, and once you get a hang of the basic movements, buffers, tabs, and filters you can really get the most out of this setup.

&nbsp;

Please feel free to comment below if you have experience daily'ing a terminal based IDE and any tips/tricks for someone getting started!

&nbsp;

### custom bindings

- ```jk``` : exit insert mode
- ```<C-f>``` : find string
- ``` yy ``` yabai bsp mode
- ``` yff ``` yabai float mode (normal tiling)

### sessions

- ``` <Space + ss> ``` save session
- ```<Space + sl> ``` load last session
- ```<Space + js> ``` load specific session using telescope

### toggleterm

- ```<Space + \>``` : open new terminal
- ```<3 + Space + \>``` : example, open 3rd terminal instance. Note: If you do this in normal mode it will create a vertical split

### nvim shortcuts

- ```<Space + th>``` : themes
- ```<Space + ch>``` : cheatsheet
- ```<Ctrl + n>``` : directory navigation
- ```<Space + ff>``` : find and open file
- ```<Space + wK>``` : key lookup
- ```<Tab>``` : switch buffers
- ```<Ctrl + W>``` : window shortcuts

### directory and windows

- ```<C+n>``` : open file tree
- ```d``` : delete folder
- ```a``` : create file
- ```r``` : rename file
- ```-``` : uncollapse file tree
- ```.``` : open vim cli command with current directory
- ```<Space+ ff>``` : find and open file
- ```<Space + fm>``` : auto-formatter using LSP
- ```<Space + h>``` : terminal window
- ```<C+>>``` or ```<C+<>``` : navigate parent folders in tree
- ```<C+Ws>``` : split window horizontally
- ```<C+Wv>``` : split window vertically
- ```<C+Ww>``` : toggle windows

### basic vim navigation

- ```$``` : end of line
- ```0``` : start of line
- ```gg``` : start of file
- ```G``` : end of file
- ```a``` : insert after cursor
- ```i``` : insert before cursor
- ```%``` : toggle start and end brace
- ```w``` : next word
- ```e``` : end of word
- ```b``` : previous word
- ```r``` : replace word
- ```%``` : toggle start and end brace
- ```:e file_path``` : edit file
- ```50%``` : go to middle of file
