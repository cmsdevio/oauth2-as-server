const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    target: 'node',
    externals: [nodeExternals()],
    devtool: 'inline-cheap-module-source-map',
    module: {
        loaders: [
            {
                test: /.jsx?$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: ['es2015', 'react'],
                    plugins: ['syntax-class-properties', 'transform-class-properties', 'transform-object-rest-spread'],
                },
            },
            {
                test: /\.css$/,
                loader: 'null-loader',
            },
            {
                test: /\.css$/,
                loader: 'null-loader',
                query: {
                    modules: true,
                    localIdentName: '[local]'
                }
            },
            {
                test: /\.png$/,
                loader: 'null-loader?limit=100000',
            },
            {
                test: /\.jpg$/,
                loader: 'null-loader',
            },
            {
                test: /\.(woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'null-loader?limit=10000&mimetype=application/font-woff',
            },
            {
                test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'null-loader?limit=10000&mimetype=application/octet-stream',
            },
            {
                test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'null-loader',
            },
            {
                test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
                loader: 'null-loader?limit=10000&mimetype=image/svg+xml',
            },
        ],
    },
};