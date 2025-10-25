const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const Dotenv = require('dotenv-webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    target: 'web',
    devtool: 'source-map',
    entry: {
        main: path.resolve(__dirname, 'src/renderer/index.tsx'),
        'tray-search': path.resolve(__dirname, 'src/renderer/tray-search.tsx'),
    },
    output: {
        path: path.resolve(__dirname, 'dist/renderer'),
        filename: 'bundle.[name].[contenthash].js',
        publicPath: './',
        clean: true,
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader', 'postcss-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'src/renderer/index.html'),
            filename: 'index.html',
            chunks: ['main'],
            minify: true,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'src/renderer/tray-search.html'),
            filename: 'tray-search.html',
            chunks: ['tray-search'],
            minify: true,
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'src/assets/icon.png'),
                    to: path.resolve(__dirname, 'dist/renderer/icon.png'),
                },
                {
                    from: path.resolve(__dirname, 'build/icon.png'),
                    to: path.resolve(__dirname, 'dist/renderer/tray-icon.png'),
                },
            ],
        }),
        new Dotenv(),
    ],
}


