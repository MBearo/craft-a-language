//Token的类型
enum TokenKind { Keyword, Identifier, StringLiteral, Seperator, Operator, EOF };

// 代表一个Token的数据结构
interface Token {
    kind: TokenKind;
    text: string;
}
/**
 * 一个字符串流。其操作为：
 * peek():预读下一个字符，但不移动指针；
 * next():读取下一个字符，并且移动指针；
 * eof():判断是否已经到了结尾。
 */
class CharStream {
    data: string;
    pos: number = 0;
    line: number = 0;
    col: number = 0;
    constructor(data: string) {
        this.data = data;
    }
    peek = () => this.data.charAt(this.pos);// 这里用的charAt
    next = () => {
        let ch = this.data.charAt(this.pos++)
        if (ch == '\n') {
            this.line++;
            this.col = 0;
        } else {
            this.col++;
        }
        return ch
    }
    eof = () => this.peek() == ''
}
/**
 * 词法分析器。
 * 词法分析器的接口像是一个流，词法解析是按需进行的。
 * 支持下面两个操作：
 * next(): 返回当前的Token，并移向下一个Token。
 * peek(): 返回当前的Token，但不移动当前位置。
 */
class Tokenizer {
    stream: CharStream;
    nextToken: Token = { kind: TokenKind.EOF, text: '' };
    constructor(stream: CharStream) {
        this.stream = stream
    }
    next = () => {
        // 第一次没有nextToken,所以先拿一个
        // 默认的nextToken是EOF，但是实际上charStream的pos还是0
        if (this.nextToken.kind == TokenKind.EOF && !this.stream.eof()) {
            this.nextToken = this.getAToken();
        }
        let lastToken = this.nextToken

        this.nextToken = this.getAToken()
        return lastToken
    }
    peek = () => {
        if (this.nextToken.kind == TokenKind.EOF && !this.stream.eof()) {
            this.nextToken = this.getAToken();
        }
        return this.nextToken;
    }
    getAToken = (): Token => {
        this.skipWhiteSpaces()
        if (this.stream.eof()) {
            return { kind: TokenKind.EOF, text: '' }
        } else {
            let ch = this.stream.peek()
            if (this.isLetter(ch) || this.isDigit(ch)) {
                return this.parseIdentifer()
            } else if (ch == '"') {
                return this.parseStringLiteral();
            } else if (
                ch == '(' || ch == ')' || ch == '{' ||
                ch == '}' || ch == ';' || ch == ','
            ) {
                this.stream.next()
                return { kind: TokenKind.Seperator, text: ch }
            } else if (ch == '/') {
                this.stream.next()
                let ch1 = this.stream.peek()
                if (ch1 == '*') {
                    this.skipMultipleLineComments()
                    return this.getAToken()
                } else if (ch1 == '/') {
                    this.skipSingleLineComments()
                    return this.getAToken()
                } else if (ch1 == '=') {
                    this.stream.next()
                    return { kind: TokenKind.Operator, text: '/=' }
                } else {
                    return { kind: TokenKind.Operator, text: '/' }
                }
            } else if (ch == '+') {
                this.stream.next();
                let ch1 = this.stream.peek();
                if (ch1 == '+') {
                    this.stream.next();
                    return { kind: TokenKind.Operator, text: '++' };
                } else if (ch1 == '=') {
                    this.stream.next();
                    return { kind: TokenKind.Operator, text: '+=' };
                }
                else {
                    return { kind: TokenKind.Operator, text: '+' };
                }
            } else if (ch == '-') {
                this.stream.next();
                let ch1 = this.stream.peek();
                if (ch1 == '-') {
                    this.stream.next();
                    return { kind: TokenKind.Operator, text: '--' };
                } else if (ch1 == '=') {
                    this.stream.next();
                    return { kind: TokenKind.Operator, text: '-=' };
                }
                else {
                    return { kind: TokenKind.Operator, text: '-' };
                }
            }
            else if (ch == '*') {
                this.stream.next();
                let ch1 = this.stream.peek();
                if (ch1 == '=') {
                    this.stream.next();
                    return { kind: TokenKind.Operator, text: '*=' };
                }
                else {
                    return { kind: TokenKind.Operator, text: '*' };
                }
            }
            else{ 
                //暂时去掉不能识别的字符
                console.log("Unrecognized pattern meeting ': " +ch+"', at" + this.stream.line + " col: " + this.stream.col);
                this.stream.next();
                return this.getAToken();
            }
        }
    }
    skipWhiteSpaces = () => { }
    isLetter = (ch: string): boolean => { }
    isDigit = (ch: string): boolean => { }
    parseIdentifer = (): Token => {
        let token: Token = { kind: TokenKind.Identifier, text: '' }
        token.text += this.stream.next()
        while (
            !this.stream.eof() &&
            this.isLetterDigitOrUnderScore(this.stream.peek())
        ) {
            token.text += this.stream.next()
        }
        if (token.text == 'function') {
            token.kind = TokenKind.Keyword
        }
        return token
    }
    isLetterDigitOrUnderScore = (ch: string) => {
        return (ch >= 'A' && ch <= 'Z' ||
            ch >= 'a' && ch <= 'z' ||
            ch >= '0' && ch <= '9' ||
            ch == '_');
    }
    parseStringLiteral = () => {

    }
}