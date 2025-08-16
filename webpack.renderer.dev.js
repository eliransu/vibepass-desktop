const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const Dotenv = require('dotenv-webpack')

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'development',
    target: 'web',
    devtool: 'inline-source-map',
    entry: path.resolve(__dirname, 'src/renderer/index.tsx'),
    output: {
        path: path.resolve(__dirname, 'dist/renderer'),
        filename: 'bundle.js',
        publicPath: '/',
    },
    devServer: {
        port: 3000,
        hot: true,
        headers: { 'Access-Control-Allow-Origin': '*' },
        historyApiFallback: true,
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
        }),
        new Dotenv(),
    ],
}


