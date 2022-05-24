//Token的类型
enum TokenKind { Keyword, Identifier, StringLiteral, Seperator, Operator, EOF };

// 代表一个Token的数据结构
interface Token {
    kind: TokenKind;
    text: string;
}

class CharStream {
    data: string;
    pos: number = 0;
    line: number = 0;
    col: number = 0;
    constructor(data: string) {
        this.data = data;
    }
    peek = () => this.data.charAt(this.pos);// 这里用的charAt
}