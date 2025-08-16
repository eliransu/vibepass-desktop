const path = require('path')
const { merge } = require('webpack-merge')

/** @type {import('webpack').Configuration} */
const base = {
    mode: 'development',
    target: 'electron-main',
    externalsPresets: { node: true },
    externals: {
        keytar: 'commonjs2 keytar',
    },
    devtool: 'inline-source-map',
    entry: {
        main: path.resolve(__dirname, 'src/main/main.ts'),
        preload: path.resolve(__dirname, 'src/main/preload.ts'),
    },
    output: {
        path: path.resolve(__dirname, 'dist/main'),
        filename: '[name].js',
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
        ],
    },
}

module.exports = merge(base, {})


