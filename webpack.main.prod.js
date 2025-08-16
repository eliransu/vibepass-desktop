const path = require('path')

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    target: 'electron-main',
    externalsPresets: { node: true },
    externals: {
        keytar: 'commonjs2 keytar',
    },
    devtool: 'source-map',
    entry: {
        main: path.resolve(__dirname, 'src/main/main.ts'),
        preload: path.resolve(__dirname, 'src/main/preload.ts'),
    },
    output: {
        path: path.resolve(__dirname, 'dist/main'),
        filename: '[name].js',
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
        ],
    },
}


