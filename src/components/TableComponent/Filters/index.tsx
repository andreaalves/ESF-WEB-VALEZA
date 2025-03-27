import { Box, Input } from "@chakra-ui/react";

export const Filter = ({ column, isVisible }: any) => {
  return (
    <>
      {(isVisible || column.filterValue) && column.canFilter && (
        <Box cursor="pointer">
          {column.canFilter && column.render("Filter")}
        </Box>
      )}
    </>
  );
};

export const DefaultColumnFilter = ({
  column: {
    filterValue,
    setFilter,
    preFilteredRows: { length },
  },
}: any) => {
  return (
    <Input
      name="filter"
      autoFocus
      size="sm"
      position="absolute"
      width="8rem"
      transform="translateY(-100%) translateX(-50%)"
      colorScheme="blackAlpha"
      bg="white"
      border="1px solid"
      value={filterValue || ""}
      onChange={(e) => {
        setFilter(e.target.value || undefined);
      }}
      placeholder={`Procurar ...`}
    />
  );
};

// export const SelectColumnFilter = ({
//   column: { filterValue, setFilter, preFilteredRows, id },
// }) => {
//   const options: any[] = React.useMemo(() => {
//     const options = new Set();
//     preFilteredRows.forEach((row) => {
//       options.add(row.values[id]);
//     });
//     return [...options.values()];
//   }, [id, preFilteredRows]);

//   return (
//     <CustomInput
//       id="custom-select"
//       type="select"
//       value={filterValue}
//       onChange={(e) => {
//         setFilter(e.target.value || undefined);
//       }}
//     >
//       <option value="">All</option>
//       {options.map((option) => (
//         <option key={option} value={option}>
//           {option}
//         </option>
//       ))}
//     </CustomInput>
//   );
// };
