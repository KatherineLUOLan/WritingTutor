import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type Props = {
    value: string;
    onChange: (v: string) => void;
};

const modules: any = {
    toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ font: [] }],
        [{ size: ['small', false, 'large', 'huge'] }],
        [{ align: [] }],
        ['clean']
    ],
};

export default function RichEditor({ value, onChange }: Props) {
    return (
        <ReactQuill
            theme="snow"
            value={value}
            onChange={onChange}
            modules={modules}
            className="rich-text-editor"
            placeholder="Enter your text here..."
        />
    );
}
