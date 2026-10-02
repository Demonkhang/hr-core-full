import { Form, Input, InputNumber, Select } from 'antd';

interface EditableCellProps {
  editing: boolean;
  dataIndex: string;
  title: string;
  inputType: string;
  inputOptions?: { label: string; value: string }[];
  record: any;
  index: number;
  children: React.ReactNode;
}

export const EditableTableCell: React.FC<EditableCellProps> = ({
  editing,
  dataIndex,
  title,
  inputType,
  inputOptions,
  children,
  ...restProps
}) => {
  const inputNode =
    inputType === 'number' ? (
      <InputNumber style={{ width: '100%' }} min={0} max={20} step={0.01} />
    ) : inputType === 'date' ? (
      <Input type="date" />
    ) : inputType === 'select' ? (
      <Select style={{ width: '100%' }} options={inputOptions} />
    ) : (
      <Input />
    );

  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={[{ required: dataIndex === 'coefficient' || dataIndex === 'effective_date' || dataIndex === 'name' || dataIndex === 'credential_type' || dataIndex === 'issue_date', message: `Vui lòng nhập ${title?.toLowerCase()}` }]}
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};
