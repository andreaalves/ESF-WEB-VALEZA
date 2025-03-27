import {
  FormControl,
  FormLabel,
  Select,
  SelectProps,
  Text,
} from "@chakra-ui/react";
import { Control, Controller, FieldValues } from "react-hook-form";

interface ISelectProps extends SelectProps {
  name: string;
  register?: any;
  errorMessage: string;
  options: any[];
  chave?: string;
  label?: string;
  control?: Control<FieldValues, object>;
}

export function SelectCustom({
  register,
  options,
  name,
  chave,
  label,
  errorMessage,
  control,
  ...rest
}: ISelectProps) {
  return (
    <>
      <FormControl>
        <FormLabel htmlFor={name}>{label}</FormLabel>

        {register ? (
          <Select
            {...register(name)}
            {...rest}
            bgColor="gray.700"
            variant="filled"
            _hover={{
              bgColor: "gray.700",
            }}
            _active={{
              color: "gray.400",
            }}
          >
            {options.map((value) => (
              <option key={value.id} value={value.id}>
                {chave && value[chave]}
              </option>
            ))}
          </Select>
        ) : (
          <Controller
            control={control}
            name={name}
            render={({ field: { onChange, value } }) => (
              <Select
                onChange={onChange}
                value={value}
                {...rest}
                bgColor="gray.700"
                variant="filled"
                _hover={{
                  bgColor: "gray.700",
                }}
                _active={{
                  color: "gray.400",
                }}
              >
                {options.map((value) => (
                  <option key={value.id} value={value.id}>
                    {chave && value[chave]}
                  </option>
                ))}
              </Select>
            )}
          />
        )}

        {<Text color="red">{errorMessage && errorMessage}</Text>}
      </FormControl>
    </>
  );
}
