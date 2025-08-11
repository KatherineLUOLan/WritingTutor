export type Role = 'user' | 'assistant' | 'error';

export interface Step {
    id: number;
    name: string;
    description: string;
}

export interface FirstStepContent {
    type: 'FirstStep';
    text: string;
    steps: Step[];
}

export interface SecondStepDropzone {
    type: 'SecondStep';
    dropzone: true;
    text: string;
}

export interface SecondStepFile {
    type: 'SecondStep';
    dropzone?: false;
    fileType: 'audio' | 'video';
    fileName: string;
    file: File;
}

export interface SuggestionContent {
    type: 'suggestion';
    title: string;
    text: string;
}

export type MessageContent =
    | string
    | FirstStepContent
    | SecondStepDropzone
    | SecondStepFile
    | SuggestionContent;

export interface ChatMessage {
    role: Role;
    content: MessageContent;
}
